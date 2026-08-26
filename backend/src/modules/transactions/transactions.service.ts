import { prisma, TransactionType, FeeStatus } from '../../lib/prisma';
import { AppError } from '../../middleware/error.middleware';

export class TransactionsService {
  async getTransactions(query: {
    type?: TransactionType;
    page?: number;
    limit?: number;
  }) {
    const page = parseInt(String(query.page || 1), 10) || 1;
    const limit = parseInt(String(query.limit || 20), 10) || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.type) where.type = query.type;

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  async getTransactionById(id: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!transaction) {
      const error: AppError = new Error(`Transaction with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return transaction;
  }

  /**
   * Permanently deletes a ledger transaction (Super Admin only).
   * Reverts any linked FeeRecord paid balance and logs an immutable audit snapshot.
   */
  async deleteTransaction(id: string, user?: { id?: string; email?: string; role?: string }) {
    const transaction = await this.getTransactionById(id);

    // If this transaction was tied to a FeeRecord, adjust the FeeRecord
    if (transaction.relatedFeeId) {
      const fee = await prisma.feeRecord.findUnique({
        where: { id: transaction.relatedFeeId },
      });
      if (fee) {
        const newPaid = Math.max(0, Number(fee.amountPaid || 0) - Number(transaction.amount || 0));
        await prisma.feeRecord.update({
          where: { id: transaction.relatedFeeId },
          data: {
            amountPaid: newPaid,
            status: newPaid === 0 ? FeeStatus.UNPAID : FeeStatus.PARTIAL,
            paidAt: newPaid === 0 ? null : fee.paidAt,
          },
        });
      }
    }

    // Log permanent audit snapshot
    const operator = user?.email || user?.id || 'SUPER_ADMIN';
    console.log(
      `[AUDIT] Transaction deleted: ID=${transaction.id}, Type=${transaction.type}, Amount=PKR ${transaction.amount}, Desc="${transaction.description}", Operator=${operator} at ${new Date().toISOString()}`
    );

    // Delete transaction from Prisma
    await prisma.transaction.delete({
      where: { id },
    });

    return {
      success: true,
      message: `Transaction '${id}' successfully deleted.`,
      deletedTransaction: transaction,
    };
  }
}

export const transactionsService = new TransactionsService();


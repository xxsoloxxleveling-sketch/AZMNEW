import { prisma, TransactionType } from '../../lib/prisma';
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
}

export const transactionsService = new TransactionsService();

import crypto from 'crypto';
import { prisma } from '../../lib/prisma';
import {
  TransactionType,
  TransactionStatus,
  TransactionSource,
  Prisma,
} from '@prisma/client';
import { AppError } from '../../middleware/error.middleware';
import {
  TransactionQueryInput,
  TransactionSummaryQueryInput,
  CreateManualTransactionInput,
} from './transactions.schema';

export class TransactionsService {
  /**
   * Retrieves a paginated list of financial ledger transactions with server-side filters.
   */
  async getTransactions(query: TransactionQueryInput) {
    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = {};

    if (query.type) {
      where.type = query.type;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.source) {
      where.source = query.source;
    }

    // Date range filter on transactionDate
    if (query.startDate || query.endDate) {
      const dateCondition: Prisma.DateTimeFilter = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        dateCondition.gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        dateCondition.lte = end;
      }
      where.transactionDate = dateCondition;
    }

    // Text search on description and referenceNumber
    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { referenceNumber: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const sortField = query.sortBy || 'transactionDate';
    const sortDirection = query.sortOrder || 'desc';

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { [sortField]: sortDirection },
          { createdAt: 'desc' },
        ],
        include: {
          feeRecord: {
            select: {
              id: true,
              studentId: true,
              challanNumber: true,
              month: true,
              status: true,
              student: {
                select: {
                  id: true,
                  fullName: true,
                  applicationNo: true,
                },
              },
            },
          },
          payrollRecord: {
            select: {
              id: true,
              staffId: true,
              month: true,
              status: true,
              staff: {
                select: {
                  id: true,
                  fullName: true,
                  role: true,
                },
              },
            },
          },
        },
      }),
      prisma.transaction.count({ where }),
    ]);

    const formattedTransactions = transactions.map((t) => ({
      ...t,
      amount: t.amount.toString(),
    }));

    return {
      transactions: formattedTransactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Calculates authoritative server-side summary totals across all matching POSTED transactions.
   * Decimal arithmetic is strictly preserved; calculations never pass through IEEE 754 floating point.
   * VOIDED transactions are strictly excluded from totals but reported in voidedCount.
   */
  async getTransactionSummary(query: TransactionSummaryQueryInput) {
    const baseWhere: Prisma.TransactionWhereInput = {};

    if (query.type) {
      baseWhere.type = query.type;
    }

    if (query.source) {
      baseWhere.source = query.source;
    }

    if (query.startDate || query.endDate) {
      const dateCondition: Prisma.DateTimeFilter = {};
      if (query.startDate) {
        const start = new Date(query.startDate);
        start.setHours(0, 0, 0, 0);
        dateCondition.gte = start;
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        dateCondition.lte = end;
      }
      baseWhere.transactionDate = dateCondition;
    }

    const postedWhere: Prisma.TransactionWhereInput = {
      ...baseWhere,
      status: TransactionStatus.POSTED,
    };

    const voidedWhere: Prisma.TransactionWhereInput = {
      ...baseWhere,
      status: TransactionStatus.VOIDED,
    };

    const [incomeAgg, expenseAgg, postedCount, voidedCount] = await Promise.all([
      prisma.transaction.aggregate({
        where: {
          ...postedWhere,
          type: { in: [TransactionType.FEE_INCOME, TransactionType.OTHER_INCOME] },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.aggregate({
        where: {
          ...postedWhere,
          type: { in: [TransactionType.SALARY_EXPENSE, TransactionType.OTHER_EXPENSE] },
        },
        _sum: { amount: true },
      }),
      prisma.transaction.count({ where: postedWhere }),
      prisma.transaction.count({ where: voidedWhere }),
    ]);

    const incomeDecimal = incomeAgg._sum.amount
      ? new Prisma.Decimal(incomeAgg._sum.amount)
      : new Prisma.Decimal(0);
    const expenseDecimal = expenseAgg._sum.amount
      ? new Prisma.Decimal(expenseAgg._sum.amount)
      : new Prisma.Decimal(0);
    const netDecimal = incomeDecimal.sub(expenseDecimal);

    return {
      currency: 'PKR',
      totalIncome: incomeDecimal.toFixed(2),
      totalExpense: expenseDecimal.toFixed(2),
      netMovement: netDecimal.toFixed(2),
      postedCount,
      voidedCount,
      period: {
        startDate: query.startDate || null,
        endDate: query.endDate || null,
      },
    };
  }

  /**
   * Retrieves a single transaction by ID with full relational and audit context.
   */
  async getTransactionById(id: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        feeRecord: {
          select: {
            id: true,
            studentId: true,
            challanNumber: true,
            month: true,
            status: true,
            student: {
              select: {
                id: true,
                fullName: true,
                applicationNo: true,
              },
            },
          },
        },
        payrollRecord: {
          select: {
            id: true,
            staffId: true,
            month: true,
            status: true,
            staff: {
              select: {
                id: true,
                fullName: true,
                role: true,
              },
            },
          },
        },
      },
    });

    if (!transaction) {
      const error: AppError = new Error(`Transaction with ID '${id}' not found.`);
      error.statusCode = 404;
      throw error;
    }

    return {
      ...transaction,
      amount: transaction.amount.toString(),
    };
  }

  /**
   * Creates a manual financial transaction (OTHER_INCOME or OTHER_EXPENSE)
   * with atomic idempotency tracking.
   */
  async createManualTransaction(
    data: CreateManualTransactionInput,
    user?: { id?: string; name?: string; email?: string },
    idempotencyKey?: string
  ): Promise<{ transaction: any; isReplay: boolean }> {
    const trimmedKey = idempotencyKey?.trim() || undefined;

    // Build canonical request identity and deterministic SHA-256 hash if key is provided
    let payloadHash: string | undefined;
    if (trimmedKey) {
      const idempotencyPayload = {
        action: 'MANUAL_LEDGER_TRANSACTION',
        requestPath: '/api/transactions',
        actorId: user?.id || null,
        type: data.type,
        amount: Number(data.amount).toFixed(2),
        description: data.description.trim(),
        transactionDate: data.transactionDate
          ? (data.transactionDate instanceof Date ? data.transactionDate.toISOString() : new Date(data.transactionDate).toISOString())
          : null,
        category: data.category?.trim() || null,
        paymentMethod: data.paymentMethod ? String(data.paymentMethod).trim() : null,
        referenceNumber: data.referenceNumber?.trim() || null,
      };

      payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(idempotencyPayload))
        .digest('hex');

      // Fast check outside transaction
      const existing = await prisma.idempotencyRecord.findUnique({
        where: { key: trimmedKey },
      });
      if (existing) {
        if (existing.expiresAt > new Date()) {
          if (
            existing.action === 'MANUAL_LEDGER_TRANSACTION' &&
            existing.payloadHash === payloadHash
          ) {
            return {
              transaction: JSON.parse(existing.response),
              isReplay: true,
            };
          } else {
            const conflictErr: AppError = new Error(
              'Idempotency key has already been used for a different request.'
            );
            conflictErr.statusCode = 409;
            throw conflictErr;
          }
        } else {
          // Clean up expired key before creating new record
          await prisma.idempotencyRecord.delete({ where: { key: trimmedKey } });
        }
      }
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        if (trimmedKey && payloadHash) {
          const existingInTx = await tx.idempotencyRecord.findUnique({
            where: { key: trimmedKey },
          });
          if (existingInTx && existingInTx.expiresAt > new Date()) {
            if (
              existingInTx.action === 'MANUAL_LEDGER_TRANSACTION' &&
              existingInTx.payloadHash === payloadHash
            ) {
              return {
                transaction: JSON.parse(existingInTx.response),
                isReplay: true,
              };
            } else {
              const conflictErr: AppError = new Error(
                'Idempotency key has already been used for a different request.'
              );
              conflictErr.statusCode = 409;
              throw conflictErr;
            }
          }
        }

        const transaction = await tx.transaction.create({
          data: {
            type: data.type,
            amount: data.amount,
            description: data.description.trim(),
            transactionDate: data.transactionDate || new Date(),
            status: TransactionStatus.POSTED,
            source: TransactionSource.MANUAL,
            category: data.category?.trim() || null,
            paymentMethod: data.paymentMethod || null,
            referenceNumber: data.referenceNumber?.trim() || null,
            createdById: user?.id || null,
            createdByName: user?.name || user?.email || 'System User',
            createdByEmail: user?.email || null,
          },
        });

        const formattedTransaction = {
          ...transaction,
          amount: transaction.amount.toString(),
        };

        if (trimmedKey && payloadHash) {
          const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
          await tx.idempotencyRecord.create({
            data: {
              key: trimmedKey,
              action: 'MANUAL_LEDGER_TRANSACTION',
              payloadHash,
              statusCode: 201,
              response: JSON.stringify(formattedTransaction),
              expiresAt,
            },
          });
        }

        return {
          transaction: formattedTransaction,
          isReplay: false,
        };
      });

      if (!result.isReplay) {
        const operator = user?.email || user?.id || 'SYSTEM';
        console.log(
          `[AUDIT] Manual transaction created: ID=${result.transaction.id}, Type=${result.transaction.type}, Amount=PKR ${result.transaction.amount}, Operator=${operator} at ${new Date().toISOString()}`
        );
      }

      return result;
    } catch (err: any) {
      if (
        trimmedKey &&
        payloadHash &&
        (err?.code === 'P2002' ||
          err?.message?.includes('P2002') ||
          err?.message?.includes('Unique constraint failed'))
      ) {
        const racedRecord = await prisma.idempotencyRecord.findUnique({
          where: { key: trimmedKey },
        });
        if (
          racedRecord &&
          racedRecord.action === 'MANUAL_LEDGER_TRANSACTION' &&
          racedRecord.payloadHash === payloadHash
        ) {
          return {
            transaction: JSON.parse(racedRecord.response),
            isReplay: true,
          };
        } else {
          const conflictErr: AppError = new Error(
            'Idempotency key has already been used for a different request.'
          );
          conflictErr.statusCode = 409;
          throw conflictErr;
        }
      }
      throw err;
    }
  }

  /**
   * Voids an existing manual transaction to preserve immutable financial audit trails.
   * Automated transactions (FEE, PAYROLL) cannot be voided from the Ledger.
   */
  async voidTransaction(
    id: string,
    reason: string,
    user?: { id?: string; name?: string; email?: string }
  ) {
    const transaction = await this.getTransactionById(id);

    if (transaction.status === TransactionStatus.VOIDED) {
      const error: AppError = new Error(`Transaction '${id}' is already voided.`);
      error.statusCode = 400;
      throw error;
    }

    if (transaction.source !== TransactionSource.MANUAL) {
      const error: AppError = new Error(
        'Automated transactions originating from Fee Collections or Payroll Disbursements cannot be voided directly from the Ledger. Please manage the source record in the respective module.'
      );
      error.statusCode = 400;
      throw error;
    }

    const voided = await prisma.transaction.update({
      where: { id },
      data: {
        status: TransactionStatus.VOIDED,
        voidedAt: new Date(),
        voidedById: user?.id || null,
        voidedByName: user?.name || user?.email || 'System User',
        voidedByEmail: user?.email || null,
        voidReason: reason.trim(),
      },
    });

    const operator = user?.email || user?.id || 'SYSTEM';
    console.log(
      `[AUDIT] Transaction voided: ID=${transaction.id}, Type=${transaction.type}, Amount=PKR ${transaction.amount}, Reason="${reason.trim()}", Operator=${operator} at ${new Date().toISOString()}`
    );

    return {
      success: true,
      message: `Transaction '${id}' has been successfully voided.`,
      transaction: {
        ...voided,
        amount: voided.amount.toString(),
      },
    };
  }

  /**
   * Physical deletion of ledger transactions is permanently disabled.
   * Throws HTTP 405 Method Not Allowed.
   */
  async deleteTransaction(id: string) {
    const error: AppError = new Error(
      `Physical deletion of financial transactions is prohibited. Ledger transactions must be voided via POST /api/transactions/${id}/void to preserve immutable audit trails.`
    );
    error.statusCode = 405;
    throw error;
  }
}

export const transactionsService = new TransactionsService();

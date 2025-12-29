import { CohereClient } from 'cohere-ai';
import type { Transaction } from '@/types/finance';
import i18next from 'i18next';

// Cohere API configuration - hardcoded for personal use
const COHERE_API_KEY = "inokSymtUT9vsmmcBvAzl5E1zr2vAZNxywqDumTj";

// Minimal category hints for AI
const AI_CATEGORY_HINTS = {
  expense: [
    { id: '1', name: 'Groceries' }, { id: '2', name: 'Dining' }, { id: '3', name: 'Transportation' },
    { id: '4', name: 'Subscription' }, { id: '5', name: 'Housing' }, { id: '6', name: 'Entertainment' },
    { id: '7', name: 'Shopping' }, { id: '8', name: 'Health' }, { id: '9', name: 'Education' },
    { id: '10', name: 'Vehicle' }, { id: '11', name: 'Personal' }, { id: '12', name: 'Other' }
  ],
  income: [
    { id: '13', name: 'Salary' }, { id: '14', name: 'Business' }, { id: '15', name: 'Investment' },
    { id: '16', name: 'Gift' }, { id: '17', name: 'Other' }
  ]
};

export interface ParsedTransaction {
  description: string;
  amount: number;
  category: string;
  categoryId: string;
  type: 'income' | 'expense';
  confidence: number;
}

export interface AIAddTransactionResponse {
  success: boolean;
  transactions: ParsedTransaction[];
  message: string;
  error?: string;
}

export class AITransactionService {
  private static instance: AITransactionService;
  private client: CohereClient;

  constructor() {
    this.client = new CohereClient({ token: COHERE_API_KEY });
  }

  static getInstance(): AITransactionService {
    if (!AITransactionService.instance) {
      AITransactionService.instance = new AITransactionService();
    }
    return AITransactionService.instance;
  }

  async parseTransactionInput(input: string, defaultWalletId?: string): Promise<AIAddTransactionResponse> {
    try {
      const language = i18next.language || 'id';
      const trimmedInput = input.trim();
      
      // Detect if this is income based on keywords
      const incomeKeywords = ['pemasukan', 'income', 'gaji', 'salary', 'terima', 'dapat', 'bonus', 'saldo'];
      const expenseKeywords = ['pengeluaran', 'expense', 'bayar', 'beli', 'belanja'];
      
      const hasIncomeKeyword = incomeKeywords.some(k => trimmedInput.toLowerCase().includes(k));
      const hasExpenseKeyword = expenseKeywords.some(k => trimmedInput.toLowerCase().includes(k));
      
      // Determine default type
      let defaultType: 'income' | 'expense' = 'expense';
      if (hasIncomeKeyword && !hasExpenseKeyword) {
        defaultType = 'income';
      }

      // Try AI parsing first
      const transactions = await this.parseWithCohere(trimmedInput, defaultType, language);
      
      if (transactions.length > 0) {
        return {
          success: true,
          transactions,
          message: language === 'id' 
            ? `Berhasil mem-parse ${transactions.length} transaksi`
            : `Successfully parsed ${transactions.length} transactions`
        };
      }

      // Fallback to regex parsing
      const fallbackTransactions = this.fallbackParseAll(trimmedInput, defaultType);
      
      if (fallbackTransactions.length > 0) {
        return {
          success: true,
          transactions: fallbackTransactions,
          message: language === 'id' 
            ? `Berhasil mem-parse ${fallbackTransactions.length} transaksi (fallback)`
            : `Successfully parsed ${fallbackTransactions.length} transactions (fallback)`
        };
      }

      return {
        success: false,
        transactions: [],
        message: i18next.t('ai.noTransactionsFound', 'No transactions found'),
        error: 'Could not parse any transactions from input'
      };
    } catch (error) {
      console.error('Error parsing transactions:', error);
      
      // Try fallback on error
      const incomeKeywords = ['pemasukan', 'income', 'gaji', 'salary', 'terima', 'dapat', 'dari'];
      const isIncome = incomeKeywords.some(k => input.toLowerCase().includes(k));
      const fallbackTransactions = this.fallbackParseAll(input, isIncome ? 'income' : 'expense');
      
      if (fallbackTransactions.length > 0) {
        return {
          success: true,
          transactions: fallbackTransactions,
          message: 'Parsed using fallback method'
        };
      }
      
      return {
        success: false,
        transactions: [],
        message: i18next.t('ai.parseError', 'Error parsing transactions'),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async parseWithCohere(
    input: string, 
    defaultType: 'income' | 'expense',
    language: string
  ): Promise<ParsedTransaction[]> {
    const systemPrompt = `You are a financial transaction parser. Parse the user's text and extract INDIVIDUAL transactions only.

CRITICAL RULES:
1. Indonesian number format: DOT is thousand separator
   - "100.000" = 100000 (one hundred thousand)
   - "1.500.000" = 1500000
   
2. SKIP these lines (they are NOT transactions):
   - Headers: "Sumber", "Jumlah", "Platform", "Saldo (Rp)", "Jumlah (Rp)"
   - Totals/Summaries: "Total Cash Masuk", "Total", "Subtotal", "Grand Total"
   - Section titles: "💰 Pemasukan", "📱 Saldo Digital", "Pengeluaran"
   - Any line that summarizes other transactions
   
3. ONLY extract actual individual transactions like:
   - "Bude Tun - 100.000" → individual gift from Bude Tun
   - "GoPay - 103.600" → individual balance/transaction
   - "Makan siang - 25.000" → individual expense

4. Family names (Bude, Kakak, Ayah, Mama, Ibu, Paman, etc.) = income, category "Gift"
5. E-wallets (GoPay, OVO, Dana, ShopeePay) = income, category "Other"

Output ONLY a JSON array with individual transactions:
[{"description": "person/item name", "amount": number, "type": "income/expense", "category": "category"}]`;

    const userPrompt = `Parse these transactions (default type: ${defaultType}). Remember to SKIP totals and summaries:

${input}

Return ONLY JSON array of INDIVIDUAL transactions (no totals):`;

    try {
      const response = await this.client.chat({
        model: 'command-r7b-12-2024',
        message: userPrompt,
        preamble: systemPrompt,
        temperature: 0.1,
      });

      const content = response.text;
      console.log('Cohere response:', content);

      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.log('No JSON array found in response');
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(parsed)) {
        return [];
      }

      const transactions: ParsedTransaction[] = [];
      
      for (const item of parsed) {
        // Skip if description contains total/summary keywords
        const desc = (item.description || '').toLowerCase();
        if (this.isSummaryLine(desc)) {
          console.log('Skipping summary line:', item.description);
          continue;
        }
        
        const amount = this.parseAmount(item.amount);
        if (amount > 0) {
          const type = item.type === 'income' ? 'income' : 'expense';
          const category = item.category || (type === 'income' ? 'Gift' : 'Other');
          
          transactions.push({
            description: item.description || 'Transaction',
            amount: amount,
            category: category,
            categoryId: this.mapToCategoryId(category, type),
            type: type,
            confidence: 0.95
          });
        }
      }

      return transactions;
    } catch (error) {
      console.error('Cohere parsing error:', error);
      return [];
    }
  }

  private isSummaryLine(text: string): boolean {
    const summaryKeywords = [
      'total', 'subtotal', 'grand total', 'jumlah', 'sum',
      'total cash', 'total masuk', 'total keluar',
      'sumber', 'platform', 'saldo (rp)', 'jumlah (rp)'
    ];
    const lowerText = text.toLowerCase();
    return summaryKeywords.some(keyword => lowerText.includes(keyword));
  }

  private fallbackParseAll(input: string, defaultType: 'income' | 'expense'): ParsedTransaction[] {
    const transactions: ParsedTransaction[] = [];
    
    // Split by newlines first
    const lines = input.split(/[\n\r]+/).filter(line => line.trim());
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip header lines (no numbers)
      if (!/\d/.test(trimmedLine)) continue;
      
      // Skip summary/total lines
      if (this.isSummaryLine(trimmedLine)) {
        console.log('Fallback: Skipping summary line:', trimmedLine);
        continue;
      }
      
      // Skip section headers
      if (trimmedLine.startsWith('💰') || trimmedLine.startsWith('📱')) continue;
      
      const parsed = this.fallbackParseLine(trimmedLine, defaultType);
      if (parsed && parsed.amount > 0) {
        transactions.push(parsed);
      }
    }
    
    return transactions;
  }

  private fallbackParseLine(item: string, defaultType: 'income' | 'expense'): ParsedTransaction | null {
    // Extract amount using regex - look for Indonesian format numbers
    const amountMatch = item.match(/[\d.]+(?:,\d+)?/g);
    if (!amountMatch) return null;

    // Take the last number match (usually the amount)
    const amountStr = amountMatch[amountMatch.length - 1];
    const amount = this.parseAmount(amountStr);
    
    if (amount <= 0) return null;

    // Extract description (everything before the amount pattern)
    const desc = this.extractDescription(item);
    
    // Skip if description looks like a summary
    if (this.isSummaryLine(desc)) return null;
    
    // Determine category based on description
    const lowerDesc = desc.toLowerCase();
    let category = defaultType === 'income' ? 'Gift' : 'Other';
    
    // E-wallet detection
    if (['gopay', 'ovo', 'dana', 'shopeepay', 'linkaja'].some(w => lowerDesc.includes(w))) {
      category = 'Other';
    }
    // Family names = Gift
    else if (['bude', 'kakak', 'ayah', 'mama', 'ibu', 'paman', 'tante', 'nenek', 'kakek'].some(w => lowerDesc.includes(w))) {
      category = 'Gift';
    }

    return {
      description: desc,
      amount: amount,
      category: category,
      categoryId: this.mapToCategoryId(category, defaultType),
      type: defaultType,
      confidence: 0.7
    };
  }

  private extractDescription(item: string): string {
    // Remove common prefixes and amount patterns
    let desc = item
      .replace(/^(sumber|dari|ke|untuk)[\s:]+/i, '')
      .replace(/[\d.]+(?:,\d+)?(\s*(ribu|rb|k|juta|jt))?$/i, '')
      .replace(/[-–—:]+$/, '')
      .trim();
    
    // Clean up common patterns
    desc = desc.replace(/\s+/g, ' ').trim();
    
    return desc || 'Transaction';
  }

  private parseAmount(amount: string | number | undefined): number {
    if (amount === undefined || amount === null) return 0;
    if (typeof amount === 'number') return Math.round(amount);
    if (typeof amount === 'string') {
      const lowerAmount = amount.toLowerCase();
      
      let multiplier = 1;
      if (lowerAmount.includes('juta') || lowerAmount.includes('jt')) {
        multiplier = 1000000;
      } else if (lowerAmount.includes('ribu') || lowerAmount.includes('rb')) {
        multiplier = 1000;
      } else if (lowerAmount.includes('k')) {
        multiplier = 1000;
      }
      
      const numericMatch = lowerAmount.match(/[\d.,]+/);
      if (!numericMatch) return 0;
      
      let numericString = numericMatch[0];
      
      // Handle Indonesian format: dots as thousand separators
      const dotCount = (numericString.match(/\./g) || []).length;
      const hasComma = numericString.includes(',');
      
      if (dotCount >= 1 && !hasComma) {
        // Check if dots are thousand separators (last part after dot is 3 digits)
        const parts = numericString.split('.');
        const lastPart = parts[parts.length - 1];
        if (lastPart.length === 3) {
          // Indonesian format: remove dots
          numericString = numericString.replace(/\./g, '');
        }
      } else if (hasComma) {
        // European/Indonesian decimal format: dots are thousands, comma is decimal
        numericString = numericString.replace(/\./g, '').replace(',', '.');
      }
      
      const numericValue = parseFloat(numericString);
      if (isNaN(numericValue)) return 0;
      
      return Math.round(numericValue * multiplier);
    }
    return 0;
  }

  private mapToCategoryId(categoryName: string | undefined, type: 'income' | 'expense'): string {
    if (!categoryName) {
      return type === 'expense' ? '12' : '17';
    }
    
    const allCategories = [...AI_CATEGORY_HINTS.expense, ...AI_CATEGORY_HINTS.income];
    const normalizedInput = categoryName.toLowerCase();
    
    let category = allCategories.find(cat => cat.name.toLowerCase() === normalizedInput);
    if (!category) {
      category = this.findBestCategoryMatch(normalizedInput, type);
    }
    
    return category?.id || (type === 'expense' ? '12' : '17');
  }

  private findBestCategoryMatch(input: string, type: 'income' | 'expense'): {id: string, name: string} | undefined {
    const categories = type === 'expense' ? AI_CATEGORY_HINTS.expense : AI_CATEGORY_HINTS.income;
    
    const keywordMap: Record<string, string[]> = {
      'gift': ['gift', 'hadiah', 'kado', 'bonus', 'uang', 'dari'],
      'salary': ['gaji', 'salary', 'pendapatan', 'upah'],
      'dining': ['makan', 'nasi', 'restoran', 'cafe', 'kopi'],
      'shopping': ['belanja', 'baju', 'sepatu', 'tas'],
      'transportation': ['transport', 'bensin', 'parkir', 'ojek', 'grab']
    };

    for (const category of categories) {
      const keywords = keywordMap[category.name.toLowerCase()] || [category.name.toLowerCase()];
      if (keywords.some(keyword => input.includes(keyword))) {
        return category;
      }
    }

    return categories.find(cat => cat.name.toLowerCase() === 'other') || categories[categories.length - 1];
  }

  validateTransactions(transactions: ParsedTransaction[]): {valid: ParsedTransaction[], invalid: ParsedTransaction[]} {
    const valid: ParsedTransaction[] = [];
    const invalid: ParsedTransaction[] = [];

    for (const tx of transactions) {
      if (tx.amount > 0 && tx.description.trim().length > 0) {
        valid.push(tx);
      } else {
        invalid.push(tx);
      }
    }

    return { valid, invalid };
  }

  convertToTransactionFormat(parsedTx: ParsedTransaction, walletId: string): Omit<Transaction, 'id' | 'userId'> {
    return {
      amount: parsedTx.amount,
      categoryId: parsedTx.categoryId,
      description: parsedTx.description,
      date: new Date().toISOString().split('T')[0],
      type: parsedTx.type,
      walletId,
      created_at: new Date().toISOString()
    };
  }
}

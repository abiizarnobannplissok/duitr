import type { Transaction } from '@/types/finance';
import type { Category } from '@/types/category';
import categoryService from '@/services/categoryService';
import i18next from 'i18next';

// Cerebras API configuration - using gpt-oss-120b for speed and power
const CEREBRAS_API_KEY = "csk-vd3p9twtkxrcet3chhh3myje8nv4phvn5n6e9kyctth63hw2";
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const MODEL = 'gpt-oss-120b';

// Keyword hints for each category to help AI match better
// These are used to enrich the prompt with context
const CATEGORY_KEYWORD_HINTS: Record<string, string[]> = {
  // Expense categories
  'groceries': ['belanja', 'supermarket', 'indomaret', 'alfamart', 'sayur', 'buah', 'daging', 'sembako', 'grocery', 'warung'],
  'dining': ['makan', 'nasi', 'restoran', 'cafe', 'kopi', 'coffee', 'restaurant', 'food', 'lunch', 'dinner', 'breakfast', 'sarapan', 'minum', 'jajan', 'snack', 'bakso', 'sate', 'padang', 'warteg', 'gopod', 'grabfood'],
  'transportation': ['transport', 'bensin', 'parkir', 'ojek', 'grab', 'gojek', 'taxi', 'bus', 'kereta', 'train', 'toll', 'tol', 'angkot', 'mrt', 'lrt', 'transjakarta', 'uber', 'maxim'],
  'subscription': ['langganan', 'subscribe', 'netflix', 'spotify', 'youtube', 'disney', 'hbo', 'amazon', 'prime', 'membership', 'icloud', 'google one', 'canva', 'figma', 'github', 'premium'],
  'housing': ['rumah', 'sewa', 'rent', 'kontrakan', 'kos', 'apartemen', 'apartment', 'listrik', 'pln', 'air', 'pdam', 'gas', 'internet', 'wifi', 'indihome', 'biznet'],
  'entertainment': ['hiburan', 'game', 'film', 'movie', 'bioskop', 'cinema', 'konser', 'concert', 'karaoke', 'steam', 'playstation', 'xbox', 'nintendo'],
  'shopping': ['belanja', 'baju', 'sepatu', 'tas', 'clothes', 'fashion', 'shoes', 'bag', 'tokopedia', 'shopee', 'lazada', 'blibli', 'zalora', 'uniqlo', 'h&m', 'zara'],
  'health': ['kesehatan', 'dokter', 'doctor', 'obat', 'medicine', 'pharmacy', 'apotek', 'rumah sakit', 'hospital', 'klinik', 'clinic', 'vitamin', 'supplement'],
  'education': ['pendidikan', 'kursus', 'course', 'buku', 'book', 'sekolah', 'school', 'kuliah', 'university', 'udemy', 'coursera', 'les', 'tutor', 'training'],
  'vehicle': ['kendaraan', 'motor', 'mobil', 'car', 'service', 'servis', 'oli', 'ban', 'tire', 'spare part', 'bengkel', 'cuci mobil', 'cuci motor'],
  'personal': ['pribadi', 'personal', 'salon', 'barber', 'potong rambut', 'skincare', 'makeup', 'parfum', 'laundry', 'dry clean'],
  'other_expense': ['lainnya', 'other', 'misc', 'lain-lain'],
  // Income categories
  'salary': ['gaji', 'salary', 'pendapatan', 'upah', 'wage', 'payroll', 'thr', 'bonus kerja'],
  'business': ['bisnis', 'business', 'usaha', 'jualan', 'penjualan', 'sales', 'profit', 'keuntungan', 'freelance', 'project'],
  'investment': ['investasi', 'investment', 'dividen', 'dividend', 'saham', 'stock', 'reksadana', 'mutual fund', 'crypto', 'bitcoin', 'bunga', 'interest'],
  'gift': ['hadiah', 'gift', 'kado', 'angpao', 'uang', 'dari', 'transfer dari', 'kiriman', 'bude', 'kakak', 'ayah', 'mama', 'ibu', 'paman', 'tante', 'nenek', 'kakek', 'saudara'],
  'other_income': ['lainnya', 'other', 'pemasukan lain']
};

export interface ParsedTransaction {
  description: string;
  amount: number;
  category: string;
  categoryId: number;
  type: 'income' | 'expense';
  confidence: number;
}

export interface AIAddTransactionResponse {
  success: boolean;
  transactions: ParsedTransaction[];
  message: string;
  error?: string;
}

interface CategoryForAI {
  id: number;
  name: string;
  type: 'income' | 'expense';
  keywords: string[];
}

export class AITransactionService {
  private static instance: AITransactionService;
  private cachedCategories: CategoryForAI[] | null = null;
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
  }

  static getInstance(): AITransactionService {
    if (!AITransactionService.instance) {
      AITransactionService.instance = new AITransactionService();
    }
    return AITransactionService.instance;
  }

  /**
   * Fetch categories from database and format for AI prompt
   * Includes caching to avoid repeated DB calls
   */
  private async getCategoriesForAI(userId?: string): Promise<CategoryForAI[]> {
    const now = Date.now();
    
    // Return cached if still valid
    if (this.cachedCategories && (now - this.cacheTimestamp) < this.CACHE_TTL) {
      return this.cachedCategories;
    }

    try {
      // Fetch all categories from database (default + user custom)
      const categories = await categoryService.getAll(userId);
      const language = i18next.language || 'id';
      
      // Format categories for AI with keyword hints
      this.cachedCategories = categories
        .filter(cat => cat.type === 'income' || cat.type === 'expense')
        .map(cat => {
          const name = language === 'id' ? cat.id_name : cat.en_name;
          const categoryKey = cat.category_key?.toLowerCase() || name.toLowerCase();
          
          // Find matching keyword hints
          let keywords: string[] = [];
          for (const [key, hints] of Object.entries(CATEGORY_KEYWORD_HINTS)) {
            if (categoryKey.includes(key) || key.includes(categoryKey.replace('_', ''))) {
              keywords = hints;
              break;
            }
          }
          
          // For custom categories, use the category name as keyword
          if (keywords.length === 0) {
            keywords = [name.toLowerCase(), cat.en_name.toLowerCase(), cat.id_name.toLowerCase()];
          }

          return {
            id: cat.category_id,
            name: name,
            type: cat.type as 'income' | 'expense',
            keywords
          };
        });

      this.cacheTimestamp = now;
      return this.cachedCategories;
    } catch (error) {
      console.error('Error fetching categories for AI:', error);
      // Return empty array on error - will use fallback
      return [];
    }
  }

  /**
   * Clear category cache (call when categories are updated)
   */
  clearCategoryCache(): void {
    this.cachedCategories = null;
    this.cacheTimestamp = 0;
  }

  async parseTransactionInput(input: string, userId?: string): Promise<AIAddTransactionResponse> {
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

      // Fetch categories from database
      const categories = await this.getCategoriesForAI(userId);

      // Try AI parsing first
      const transactions = await this.parseWithCerebras(trimmedInput, defaultType, language, categories);
      
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
      const fallbackTransactions = this.fallbackParseAll(trimmedInput, defaultType, categories);
      
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
      const categories = await this.getCategoriesForAI(userId);
      const incomeKeywords = ['pemasukan', 'income', 'gaji', 'salary', 'terima', 'dapat', 'dari'];
      const isIncome = incomeKeywords.some(k => input.toLowerCase().includes(k));
      const fallbackTransactions = this.fallbackParseAll(input, isIncome ? 'income' : 'expense', categories);
      
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

  private async parseWithCerebras(
    input: string, 
    defaultType: 'income' | 'expense',
    language: string,
    categories: CategoryForAI[]
  ): Promise<ParsedTransaction[]> {
    // Build category list for prompt
    const expenseCategories = categories.filter(c => c.type === 'expense');
    const incomeCategories = categories.filter(c => c.type === 'income');

    const formatCategoryList = (cats: CategoryForAI[]) => 
      cats.map(c => `  - ID ${c.id}: "${c.name}" (keywords: ${c.keywords.slice(0, 5).join(', ')})`).join('\n');

    const systemPrompt = `You are a financial transaction parser. Parse the user's text and extract INDIVIDUAL transactions only.

AVAILABLE CATEGORIES:

EXPENSE CATEGORIES:
${formatCategoryList(expenseCategories)}

INCOME CATEGORIES:
${formatCategoryList(incomeCategories)}

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

4. CATEGORY MATCHING - Use the category_id from the list above:
   - Match keywords in the transaction description to find the best category
   - For food/eating related: use Dining category
   - For subscriptions (Netflix, Spotify, etc.): use Subscription category
   - For transport (Grab, Gojek, bensin): use Transportation category
   - For family names (Bude, Kakak, Ayah, etc.): use Gift category (income)
   - E-wallets (GoPay, OVO, Dana): use Other category

5. OUTPUT FORMAT - Return a JSON array with these exact fields:
   - description: string (item/person name)
   - amount: number (parsed amount as integer)
   - type: "income" or "expense"
   - category_id: number (the ID from the category list above)
   - category_name: string (the name of the selected category)

Output ONLY a JSON array, no explanation:
[{"description": "name", "amount": 100000, "type": "expense", "category_id": 2, "category_name": "Dining"}]`;

    const userPrompt = `Parse these transactions (default type: ${defaultType}). Remember to SKIP totals and summaries:

${input}

Return ONLY JSON array of INDIVIDUAL transactions (no totals):`;

    try {
      const response = await fetch(CEREBRAS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1000,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Cerebras API error:', response.status, errorText);
        return [];
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || '';
      console.log('Cerebras response:', content);

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
          const categoryName = item.category_name || (type === 'income' ? 'Other' : 'Other');
          
          // Use category_id from AI response, or find by name
          let categoryId = item.category_id;
          if (!categoryId || typeof categoryId !== 'number') {
            categoryId = this.findCategoryIdByName(categoryName, type, categories);
          }
          
          // Validate category exists
          const validCategory = categories.find(c => c.id === categoryId);
          if (!validCategory) {
            categoryId = this.getDefaultCategoryId(type, categories);
          }
          
          transactions.push({
            description: item.description || 'Transaction',
            amount: amount,
            category: validCategory?.name || categoryName,
            categoryId: categoryId,
            type: type,
            confidence: 0.95
          });
        }
      }

      return transactions;
    } catch (error) {
      console.error('Cerebras parsing error:', error);
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

  private fallbackParseAll(input: string, defaultType: 'income' | 'expense', categories: CategoryForAI[]): ParsedTransaction[] {
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
      
      const parsed = this.fallbackParseLine(trimmedLine, defaultType, categories);
      if (parsed && parsed.amount > 0) {
        transactions.push(parsed);
      }
    }
    
    return transactions;
  }

  private fallbackParseLine(item: string, defaultType: 'income' | 'expense', categories: CategoryForAI[]): ParsedTransaction | null {
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
    
    // Find best matching category
    const { categoryId, categoryName } = this.findBestCategory(desc, defaultType, categories);

    return {
      description: desc,
      amount: amount,
      category: categoryName,
      categoryId: categoryId,
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

  /**
   * Find the best matching category based on description keywords
   */
  private findBestCategory(
    description: string, 
    type: 'income' | 'expense', 
    categories: CategoryForAI[]
  ): { categoryId: number; categoryName: string } {
    const lowerDesc = description.toLowerCase();
    const typeCategories = categories.filter(c => c.type === type);
    
    // Score each category based on keyword matches
    let bestMatch: CategoryForAI | null = null;
    let bestScore = 0;

    for (const category of typeCategories) {
      let score = 0;
      for (const keyword of category.keywords) {
        if (lowerDesc.includes(keyword.toLowerCase())) {
          // Longer keyword matches get higher score
          score += keyword.length;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = category;
      }
    }

    if (bestMatch) {
      return { categoryId: bestMatch.id, categoryName: bestMatch.name };
    }

    // Return default "Other" category for the type
    const defaultCat = typeCategories.find(c => 
      c.name.toLowerCase().includes('other') || 
      c.name.toLowerCase().includes('lainnya')
    );
    
    if (defaultCat) {
      return { categoryId: defaultCat.id, categoryName: defaultCat.name };
    }

    // Last resort: return first category of that type
    if (typeCategories.length > 0) {
      return { categoryId: typeCategories[0].id, categoryName: typeCategories[0].name };
    }

    // Absolute fallback
    return { categoryId: 12, categoryName: 'Other' };
  }

  /**
   * Find category ID by name
   */
  private findCategoryIdByName(name: string, type: 'income' | 'expense', categories: CategoryForAI[]): number {
    const lowerName = name.toLowerCase();
    const typeCategories = categories.filter(c => c.type === type);
    
    // Exact match first
    const exact = typeCategories.find(c => c.name.toLowerCase() === lowerName);
    if (exact) return exact.id;
    
    // Partial match
    const partial = typeCategories.find(c => 
      c.name.toLowerCase().includes(lowerName) || 
      lowerName.includes(c.name.toLowerCase())
    );
    if (partial) return partial.id;
    
    // Return default
    return this.getDefaultCategoryId(type, categories);
  }

  /**
   * Get default category ID for a type (usually "Other")
   */
  private getDefaultCategoryId(type: 'income' | 'expense', categories: CategoryForAI[]): number {
    const typeCategories = categories.filter(c => c.type === type);
    
    // Find "Other" category
    const other = typeCategories.find(c => 
      c.name.toLowerCase().includes('other') || 
      c.name.toLowerCase().includes('lainnya')
    );
    
    if (other) return other.id;
    
    // Return first category of that type, or fallback
    if (typeCategories.length > 0) return typeCategories[0].id;
    
    return type === 'expense' ? 12 : 17; // Hardcoded fallback
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

// AI Finance Insight API - Powered by Cohere
import { CohereClient } from 'cohere-ai';
import type { FinanceSummary } from '@/types/finance';
import i18next from 'i18next';

// Cohere API configuration - hardcoded for personal use
const COHERE_API_KEY = "inokSymtUT9vsmmcBvAzl5E1zr2vAZNxywqDumTj";

// Initialize Cohere client
const cohere = new CohereClient({ token: COHERE_API_KEY });

/**
 * Get AI-powered financial insight using Cohere
 * Model: command-r-plus (best for reasoning & financial analysis)
 */
export async function getFinanceInsight(summary: FinanceSummary): Promise<string> {
  try {
    const language = i18next.language || 'id';
    const prompt = buildPrompt(summary, language);
    
    const response = await cohere.chat({
      model: 'command-r-plus', // Best model for financial analysis & reasoning
      message: prompt,
      temperature: 0.3, // Lower temperature for more consistent, factual analysis
      maxTokens: 1500, // Longer response for comprehensive analysis
    });

    const result = response.text?.trim();
    
    if (!result) {
      return language === 'id' 
        ? 'Maaf, gagal mendapatkan analisis dari AI. Silakan coba lagi.'
        : 'Sorry, failed to get insight from AI. Please try again.';
    }

    return result;
  } catch (error) {
    console.error('Error getting finance insight:', error);
    const language = i18next.language || 'id';
    throw new Error(
      language === 'id' 
        ? 'Gagal mendapatkan analisis dari AI. Silakan coba lagi.'
        : 'Failed to get insight from AI. Please try again.'
    );
  }
}

/**
 * Ask AI a specific question about your finances
 * Model: command-r-plus (best for Q&A reasoning)
 */
export async function askAI(question: string, context: FinanceSummary): Promise<string> {
  try {
    const language = i18next.language || 'id';
    const contextPrompt = buildContextPrompt(context, language);
    
    const systemPrompt = language === 'id'
      ? `Kamu adalah asisten keuangan pribadi yang ahli dalam analisis keuangan individu di Indonesia. Berikan jawaban yang spesifik, praktis, dan berbasis data keuangan pengguna.`
      : `You are a personal finance assistant expert in individual financial analysis in Indonesia. Provide specific, practical answers based on user's financial data.`;

    const userMessage = `${contextPrompt}\n\n${language === 'id' ? 'Pertanyaan' : 'Question'}: ${question}`;
    
    const response = await cohere.chat({
      model: 'command-r-plus',
      message: userMessage,
      preamble: systemPrompt,
      temperature: 0.3,
      maxTokens: 800,
    });

    const result = response.text?.trim();
    
    if (!result) {
      return language === 'id'
        ? 'Maaf, tidak dapat menjawab pertanyaan ini.'
        : 'Sorry, cannot answer this question.';
    }

    return result;
  } catch (error) {
    console.error('Error asking AI:', error);
    const language = i18next.language || 'id';
    throw new Error(
      language === 'id'
        ? 'Gagal mendapatkan jawaban dari AI. Silakan coba lagi.'
        : 'Failed to get answer from AI. Please try again.'
    );
  }
}

function buildPrompt(summary: FinanceSummary, language: string): string {
  const { startDate, endDate, income, expenses } = summary;

  const formatCategoryItems = (
    items: Array<{ category: string; amount: number }>, 
    type: 'pemasukan' | 'pengeluaran',
    total: number
  ) => {
    if (items.length === 0) {
      return type === 'pemasukan'
        ? (language === 'id' ? 'Tidak ada pemasukan yang tercatat.' : 'No income recorded.')
        : (language === 'id' ? 'Tidak ada pengeluaran yang tercatat.' : 'No expenses recorded.');
    }
    
    const grouped = items.reduce((acc, item) => {
      const category = item.category || (language === 'id' ? 'Lain-lain' : 'Other');
      acc[category] = (acc[category] || 0) + item.amount;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(grouped)
      .sort((a, b) => b[1] - a[1])
      .map(([category, amount]) => {
        const percentage = total > 0 ? ` (${((amount / total) * 100).toFixed(1)}%)` : '';
        return `- ${category}: Rp${amount.toLocaleString('id-ID')}${percentage}`;
      })
      .join('\n');
  };

  const incomeText = formatCategoryItems(income, 'pemasukan', summary.totalIncome);
  const expenseText = formatCategoryItems(expenses, 'pengeluaran', summary.totalExpenses);
  const savingRate = summary.totalIncome > 0 
    ? ((summary.netFlow / summary.totalIncome) * 100).toFixed(1)
    : '0';

  if (language === 'id') {
    return `Kamu adalah asisten keuangan pribadi yang ahli dalam analisis keuangan individu di Indonesia.

EVALUASI KEUANGAN
Periode: ${startDate} s/d ${endDate}

📊 RINGKASAN KEUANGAN
• Total Pemasukan: Rp${summary.totalIncome.toLocaleString('id-ID')}
• Total Pengeluaran: Rp${summary.totalExpenses.toLocaleString('id-ID')}
• Saldo Bersih: Rp${summary.netFlow.toLocaleString('id-ID')} (${savingRate}% dari pemasukan)

📥 DETAIL PEMASUKAN
${incomeText}

📤 DETAIL PENGELUARAN
${expenseText}

🔍 TUGAS ANDA:
1. **Status Keuangan** - Berikan penilaian kondisi keuangan (Sehat/Perlu Perhatian/Kritis) dengan alasan singkat
2. **Analisis Pola** - Identifikasi 2-3 pola penting, termasuk kategori yang dominan dan tren pengeluaran
3. **Rekomendasi** - Berikan saran spesifik berdasarkan pola yang terlihat, fokus pada kategori pengeluaran terbesar
4. **Tips Praktis** - Berikan 1-2 strategi penghematan atau peningkatan pendapatan yang realistis untuk konteks Indonesia

FORMAT JAWABAN:
Gunakan bahasa Indonesia yang mudah dipahami, santai namun profesional. Maksimal 5 paragraf. Beri penekanan pada aspek yang memerlukan perhatian khusus.`;
  } else {
    return `You are a personal finance assistant expert in individual financial analysis in Indonesia.

FINANCIAL EVALUATION
Period: ${startDate} to ${endDate}

📊 FINANCIAL SUMMARY
• Total Income: Rp${summary.totalIncome.toLocaleString('id-ID')}
• Total Expenses: Rp${summary.totalExpenses.toLocaleString('id-ID')}
• Net Flow: Rp${summary.netFlow.toLocaleString('id-ID')} (${savingRate}% of income)

📥 INCOME DETAILS
${incomeText}

📤 EXPENSE DETAILS
${expenseText}

🔍 YOUR TASKS:
1. **Financial Status** - Provide an assessment of current financial condition (Healthy/Needs Attention/Critical) with brief reasoning
2. **Pattern Analysis** - Identify 2-3 important patterns from the financial data, including dominant categories and spending trends
3. **Recommendations** - Provide specific advice based on observed patterns, focusing on largest expense categories
4. **Practical Tips** - Provide 1-2 realistic saving strategies or income improvement tips for Indonesian context

ANSWER FORMAT:
Use easy-to-understand English, friendly yet professional. Maximum 5 paragraphs. Emphasize aspects that need special attention.`;
  }
}

function buildContextPrompt(summary: FinanceSummary, language: string): string {
  const savingRate = summary.totalIncome > 0 
    ? ((summary.netFlow / summary.totalIncome) * 100).toFixed(1)
    : '0';

  if (language === 'id') {
    return `KONTEKS KEUANGAN PENGGUNA:
Periode: ${summary.startDate} s/d ${summary.endDate}
Total Pemasukan: Rp${summary.totalIncome.toLocaleString('id-ID')}
Total Pengeluaran: Rp${summary.totalExpenses.toLocaleString('id-ID')}
Saldo Bersih: Rp${summary.netFlow.toLocaleString('id-ID')} (${savingRate}%)`;
  } else {
    return `USER'S FINANCIAL CONTEXT:
Period: ${summary.startDate} to ${summary.endDate}
Total Income: Rp${summary.totalIncome.toLocaleString('id-ID')}
Total Expenses: Rp${summary.totalExpenses.toLocaleString('id-ID')}
Net Flow: Rp${summary.netFlow.toLocaleString('id-ID')} (${savingRate}%)`;
  }
}

import type { FinanceSummary } from '@/types/finance';
import i18next from 'i18next';

const CEREBRAS_API_KEY = "csk-vd3p9twtkxrcet3chhh3myje8nv4phvn5n6e9kyctth63hw2";
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const MODEL = 'gpt-oss-120b';

interface CerebrasMessage {
  role: 'user' | 'system' | 'assistant';
  content: string;
}

interface CerebrasResponse {
  choices: Array<{
    message: {
      content?: string;
    };
  }>;
}

async function callCerebras(messages: CerebrasMessage[], maxTokens = 800): Promise<string> {
  console.log('[AI] Calling Cerebras with model:', MODEL);
  
  const response = await fetch(CEREBRAS_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[AI] Cerebras API error:', response.status, errorText);
    throw new Error(`Cerebras API error: ${response.status}`);
  }

  const data: CerebrasResponse = await response.json();
  const result = data.choices[0]?.message?.content?.trim() || '';
  console.log('[AI] Response received, length:', result.length);
  return result;
}

function cleanMarkdownSymbols(text: string): string {
  return text
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '**$1**')
    .trim();
}

export async function getFinanceInsight(summary: FinanceSummary): Promise<string> {
  try {
    const language = i18next.language || 'id';
    const prompt = buildPrompt(summary, language);
    
    const rawResult = await callCerebras([{ role: 'user', content: prompt }], 800);
    
    if (!rawResult) {
      console.error('[AI] Empty response from model');
      return language === 'id'
        ? 'Maaf, tidak dapat menjawab pertanyaan ini.'
        : 'Sorry, cannot answer this question.';
    }

    return cleanMarkdownSymbols(rawResult);
  } catch (error) {
    console.error('[AI] getFinanceInsight error:', error);
    const language = i18next.language || 'id';
    throw new Error(
      language === 'id'
        ? 'Gagal mendapatkan jawaban dari AI. Silakan coba lagi.'
        : 'Failed to get answer from AI. Please try again.'
    );
  }
}

export async function askAI(question: string, context: FinanceSummary): Promise<string> {
  try {
    const language = i18next.language || 'id';
    const contextPrompt = buildContextPrompt(context, language);
    
    const systemPrompt = language === 'id'
      ? `Kamu adalah asisten keuangan pribadi yang ahli dalam analisis keuangan individu di Indonesia. Berikan jawaban yang spesifik, praktis, dan berbasis data keuangan pengguna.`
      : `You are a personal finance assistant expert in individual financial analysis in Indonesia. Provide specific, practical answers based on user's financial data.`;

    const userMessage = `${contextPrompt}\n\n${language === 'id' ? 'Pertanyaan' : 'Question'}: ${question}`;
    
    const rawResult = await callCerebras([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ], 600);
    
    if (!rawResult) {
      return language === 'id'
        ? 'Maaf, tidak dapat menjawab pertanyaan ini.'
        : 'Sorry, cannot answer this question.';
    }

    return cleanMarkdownSymbols(rawResult);
  } catch (error) {
    console.error('[AI] askAI error:', error);
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
    return `Kamu adalah analis keuangan berpengalaman 10 tahun yang ahli dalam konsultasi keuangan pribadi di Indonesia.

DATA KEUANGAN
Periode: ${startDate} - ${endDate}
Pemasukan: Rp${summary.totalIncome.toLocaleString('id-ID')}
Pengeluaran: Rp${summary.totalExpenses.toLocaleString('id-ID')}
Saldo: Rp${summary.netFlow.toLocaleString('id-ID')} (${savingRate}%)

${incomeText ? 'Sumber Pemasukan:\n' + incomeText : ''}

${expenseText ? 'Pengeluaran Utama:\n' + expenseText : ''}

INSTRUKSI:
Berikan analisis keuangan yang ringkas namun informatif dalam format berikut (maksimal 350 kata):

**Status Keuangan:** [Sehat/Perlu Perhatian/Kritis] - Jelaskan kondisi dalam 2 kalimat pendek. Sertakan saving rate dan artinya.

**Analisis Pola Pengeluaran:** Identifikasi 2 pola utama dalam 2-3 kalimat. Sebutkan kategori dominan dengan persentase dan bandingkan dengan ideal.

**Rekomendasi:** Berikan 2 saran konkret dalam 2-3 kalimat. Sertakan angka target yang spesifik untuk setiap saran.

**Koreksi Kedepan:** Buat action plan singkat 3 bulan dalam 2-3 kalimat. Setiap bulan 1 target konkret.

**Tips Keuangan Sehat:** Berikan 1 prinsip atau strategi dalam 1-2 kalimat. Fokus pada yang paling relevan untuk kondisi user.

PENTING:
- MAKSIMAL 350 kata total - setiap bagian harus RINGKAS
- Setiap poin maksimal 2-3 kalimat PENDEK
- Gunakan bahasa Indonesia yang efisien dan to the point
- JANGAN bertele-tele, langsung ke inti
- JANGAN gunakan simbol # atau markdown heading
- Gunakan format **Judul:** untuk penekanan
- Sertakan angka spesifik dan persentase
- Lebih baik pendek tapi padat daripada panjang tapi repetitif`;
  } else {
    return `You are a 10-year experienced financial analyst specializing in personal finance consulting in Indonesia.

DATA KEUANGAN
Period: ${startDate} - ${endDate}
Income: Rp${summary.totalIncome.toLocaleString('id-ID')}
Expenses: Rp${summary.totalExpenses.toLocaleString('id-ID')}
Net Balance: Rp${summary.netFlow.toLocaleString('id-ID')} (${savingRate}%)

${incomeText ? 'Income Sources:\n' + incomeText : ''}

${expenseText ? 'Main Expenses:\n' + expenseText : ''}

INSTRUCTIONS:
Provide a concise yet informative financial analysis in this format (maximum 350 words):

**Financial Status:** [Healthy/Needs Attention/Critical] - Explain condition in 2 short sentences. Include saving rate and its meaning.

**Spending Pattern Analysis:** Identify 2 main patterns in 2-3 sentences. Mention dominant categories with percentages and compare with ideal.

**Recommendations:** Provide 2 concrete suggestions in 2-3 sentences. Include specific target numbers for each suggestion.

**Future Corrections:** Create a brief 3-month action plan in 2-3 sentences. One concrete target per month.

**Healthy Finance Tips:** Provide 1 principle or strategy in 1-2 sentences. Focus on what's most relevant for user's condition.

IMPORTANT:
- MAXIMUM 350 words total - each section must be CONCISE
- Each point maximum 2-3 SHORT sentences
- Use efficient and to-the-point English
- DON'T be verbose, get straight to the point
- DO NOT use # symbols or markdown headings
- Use **Title:** format for emphasis
- Include specific numbers and percentages
- Better short but dense than long but repetitive`;
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

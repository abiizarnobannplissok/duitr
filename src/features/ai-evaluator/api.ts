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
    return `Kamu adalah teman yang baru belajar soal keuangan. Jelaskan dengan bahasa SEDERHANA seperti ngobrol sama teman, pakai kata-kata sehari-hari yang gampang dipahami.

DATA KEUANGAN
Periode: ${startDate} - ${endDate}
Pemasukan: Rp${summary.totalIncome.toLocaleString('id-ID')}
Pengeluaran: Rp${summary.totalExpenses.toLocaleString('id-ID')}
Sisa: Rp${summary.netFlow.toLocaleString('id-ID')} (${savingRate}% dari pemasukan)

${incomeText ? 'Sumber Uang Masuk:\n' + incomeText : ''}

${expenseText ? 'Uang Keluar Buat:\n' + expenseText : ''}

INSTRUKSI:
Jelaskan kondisi keuangan dengan BAHASA SANTAI dan MUDAH DIPAHAMI. Pakai format ini:

**Gimana Kondisi Keuanganmu?**
• Kasih nilai: Bagus banget 🎉 / Lumayan oke 👍 / Perlu diperbaiki ⚠️ / Bahaya nih 🚨
• Jelaskan simpel: dari Rp[pemasukan], kamu bisa sisain Rp[sisa] atau [X]%. Artinya [penjelasan sederhana].

**Yang Perlu Diperhatiin:**
• [Kategori 1]: Kamu habis Rp[jumlah] buat ini. [Komentar singkat - kebanyakan/wajar/oke]
• [Kategori 2]: Rp[jumlah] buat ini. [Komentar singkat]
• [Kategori 3 jika ada]: dst.

**Yang Harus Diperbaiki:**
• [Masalah 1]: [Jelaskan simpel kenapa ini masalah dan dampaknya]
• [Masalah 2]: [Jelaskan simpel]

**Saran Biar Lebih Baik:**
• [Saran 1]: [Langkah konkret dengan angka, misal "Coba kurangi makan di luar jadi max Rp50rb/minggu"]
• [Saran 2]: [Langkah konkret dengan angka]
• [Saran 3]: [Langkah konkret dengan angka]

**Tips Simpel:**
• [Tips praktis yang bisa langsung dipraktekkin, pakai bahasa sehari-hari]

ATURAN PENTING:
- Pakai bahasa SANTAI kayak ngobrol sama teman
- JANGAN pakai istilah keuangan yang ribet (jangan "saving rate", pakai "uang yang bisa disisihin")
- Pakai emoji biar lebih friendly 😊
- Kasih angka yang SPESIFIK dan REALISTIS
- Setiap poin SINGKAT, maksimal 1-2 kalimat
- JANGAN pakai # atau heading, pakai **Judul:** aja
- Total maksimal 400 kata`;
  } else {
    return `You are a friend who's just learning about finances. Explain in SIMPLE language like chatting with a buddy, using everyday words that are easy to understand.

FINANCIAL DATA
Period: ${startDate} - ${endDate}
Income: Rp${summary.totalIncome.toLocaleString('id-ID')}
Expenses: Rp${summary.totalExpenses.toLocaleString('id-ID')}
Left over: Rp${summary.netFlow.toLocaleString('id-ID')} (${savingRate}% of income)

${incomeText ? 'Money Coming In:\n' + incomeText : ''}

${expenseText ? 'Money Going Out:\n' + expenseText : ''}

INSTRUCTIONS:
Explain the financial situation in CASUAL and EASY TO UNDERSTAND language. Use this format:

**How's Your Money Doing?**
• Give a rating: Awesome 🎉 / Pretty good 👍 / Needs work ⚠️ / Uh oh 🚨
• Explain simply: from Rp[income], you saved Rp[leftover] or [X]%. That means [simple explanation].

**Things to Watch:**
• [Category 1]: You spent Rp[amount] on this. [Quick comment - too much/okay/fine]
• [Category 2]: Rp[amount] on this. [Quick comment]
• [Category 3 if any]: etc.

**What Needs Fixing:**
• [Issue 1]: [Explain simply why this is a problem and its impact]
• [Issue 2]: [Explain simply]

**Tips to Do Better:**
• [Tip 1]: [Concrete step with numbers, like "Try limiting eating out to max Rp50k/week"]
• [Tip 2]: [Concrete step with numbers]
• [Tip 3]: [Concrete step with numbers]

**Quick Tip:**
• [Practical tip you can use right away, in everyday language]

IMPORTANT RULES:
- Use CASUAL language like talking to a friend
- DON'T use complicated financial terms (not "saving rate", say "money you could save")
- Use emojis to be friendly 😊
- Give SPECIFIC and REALISTIC numbers
- Each point SHORT, max 1-2 sentences
- DON'T use # or headings, use **Title:** only
- Maximum 400 words total`;
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

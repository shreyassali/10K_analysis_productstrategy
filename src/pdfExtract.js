import * as pdfjsLib from 'pdfjs-dist';

// Point worker to the bundled worker file
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const numPages = pdf.numPages;
  const texts = [];
  
  // Extract text from all pages
  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(' ');
    texts.push(pageText);
  }
  
  const fullText = texts.join('\n');
  
  // 10-K PDFs can be 300+ pages. We need the most relevant sections:
  // Business (Item 1), Risk Factors (Item 1A), MD&A (Item 7)
  // Slice to ~25000 chars which covers most of the key sections
  return fullText.slice(0, 25000);
}

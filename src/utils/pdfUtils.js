import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * pdfUtils.js
 * Utility functions for advanced PDF processing using pdfjs-dist.
 */

/**
 * Finds all occurrences of a string in a PDF and returns their coordinates.
 * Note: pdfjs-dist coordinate system starts from bottom-left (0,0).
 */
export const findTextCoordinates = async (pdfBytes, searchText) => {
    const loadingTask = pdfjs.getDocument({ data: pdfBytes });
    const pdf = await loadingTask.promise;
    const occurrences = [];

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();

        // Items are glyphs/text fragments
        // We need to group them or find the specific one
        // For simple Find & Replace, we look for exact matches in the text content
        let pageText = "";
        const fragments = textContent.items.map(item => ({
            text: item.str,
            transform: item.transform, // [scaleX, skewY, skewX, scaleY, translateX, translateY]
            width: item.width,
            height: item.height
        }));

        // Find matches in fragments
        // A more advanced version would handle text split across multiple fragments
        fragments.forEach((fragment) => {
            if (fragment.text.includes(searchText)) {
                // Approximate coordinates (pdf-lib uses different system than pdfjs sometimes, need conversion)
                // pdfjs transform: [1, 0, 0, 1, x, y]
                occurrences.push({
                    pageIndex: i - 1,
                    text: fragment.text,
                    x: fragment.transform[4],
                    y: fragment.transform[5],
                    width: fragment.width,
                    height: fragment.height
                });
            }
        });
    }

    return occurrences;
};

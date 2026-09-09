import type { Book, BookLanguage, Chapter } from '@/lib/types';
import { initMobiFile } from '@lingo-reader/mobi-parser';

// Type definitions for epubjs archive
interface EPUBArchive {
  createUrl(href: string, options?: { base64?: boolean }): Promise<string>;
}

interface EPUBBook {
  archive?: EPUBArchive;
  loaded: {
    metadata?: Promise<{ title?: string; creator?: string }> | { title?: string; creator?: string };
    navigation?: Promise<{ toc: Array<{ href: string; title: string; subitems?: any[] }> }>;
    cover?: Promise<string>;
    spine?: unknown;
  };
  open(data: ArrayBuffer): Promise<void>;
  load(href: string): Promise<Document>;
  manifest?: { [key: string]: { href?: string; properties?: string } };
}

// Convert blob URL to base64 data URL for persistence
async function blobToBase64(blobUrl: string): Promise<string | undefined> {
  try {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(undefined);
      reader.readAsDataURL(blob);
    });
  } catch {
    return undefined;
  }
}

function detectLanguage(filename: string, content: string): BookLanguage {
  const ext = filename.toLowerCase();
  if (ext.includes('en')) return 'en';
  if (ext.includes('ja') || ext.includes('jp')) return 'ja';
  if (ext.includes('ko') || ext.includes('kr')) return 'ko';
  if (ext.includes('zh') || ext.includes('cn')) return 'zh';

  const cjkCount = (content.match(/[一-鿿぀-ゟ゠-ヿ가-힯]/g) || []).length;
  const totalChars = content.replace(/\s/g, '').length;
  const cjkRatio = totalChars > 0 ? cjkCount / totalChars : 0;

  if (cjkRatio > 0.3) {
    const japaneseChars = (content.match(/[぀-ゟ゠-ヿ]/g) || []).length;
    const koreanChars = (content.match(/[가-힯]/g) || []).length;
    if (japaneseChars > koreanChars) return 'ja';
    if (koreanChars > cjkCount * 0.3) return 'ko';
    return 'zh';
  }

  return 'en';
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function extractAuthor(metadata: any): string {
  // Try multiple possible author field names
  const creator = metadata?.creator || metadata?.author || metadata?.artist || metadata?.contributor || metadata?.['dc:creator'];
  if (!creator) return 'Unknown';

  // Handle string
  if (typeof creator === 'string') return creator.trim() || 'Unknown';

  // Handle array (epubjs sometimes returns array)
  if (Array.isArray(creator)) {
    const authors = creator
      .map(c => {
        if (typeof c === 'string') return c.trim();
        if (typeof c === 'object' && c !== null) {
          // Try various possible field names in object
          return c['']?.trim() || c.name?.trim() || c.text?.trim() || c.value?.trim() || c['#']?.trim() || '';
        }
        return '';
      })
      .filter(Boolean);
    return authors.join(', ') || 'Unknown';
  }

  // Handle object (epubjs returns { '#': 'author name' } or { name: 'author name' })
  if (typeof creator === 'object') {
    return creator['']?.trim() || creator.name?.trim() || creator.text?.trim() || creator.value?.trim() || creator['#']?.trim() || 'Unknown';
  }

  return 'Unknown';
}

export async function parseTextFile(file: File): Promise<{ content: string; title: string; chapters: Chapter[] }> {
  const text = await file.text();
  const title = file.name.replace(/\.[^/.]+$/, '');
  return { content: text, title, chapters: [] };
}

// Check if a filename matches non-content chapter patterns
function isNonContentChapter(href: string, body: HTMLElement): boolean {
  const lowerHref = href.toLowerCase();

  // Only filter by filename for clear non-content files
  const patterns = ['cover', 'copyright', 'toc', 'nav', 'title-page', 'title_page', 'colophon', 'acknowledgements', 'acknowledgments'];
  for (const pattern of patterns) {
    if (lowerHref.includes(pattern)) return true;
  }

  // Skip if content is too short (<30 chars)
  const text = body.textContent || '';
  if (text.trim().length < 30) return true;

  return false;
}

// Extract text content while preserving ruby (furigana) tags
function extractTextWithRuby(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element;
    const tagName = element.tagName.toLowerCase();

    // Block-level elements that should preserve paragraph structure
    const blockTags = ['p', 'div', 'br', 'h1', 'h2', 'h3', 'h4', 'li', 'blockquote', 'section', 'article'];
    const isBlock = blockTags.includes(tagName);

    // Preserve ruby tags for furigana - output as 漢字(かんじ) format
    if (tagName === 'ruby') {
      let baseText = '';
      let readingText = '';

      for (const child of Array.from(element.childNodes)) {
        if (child.nodeType === Node.ELEMENT_NODE) {
          const childEl = child as Element;
          const childTag = childEl.tagName.toLowerCase();
          if (childTag === 'rb' || childTag === 'rbc') {
            baseText += extractTextWithRuby(child);
          } else if (childTag === 'rt' || childTag === 'rtc') {
            readingText += extractTextWithRuby(child);
          }
        } else if (child.nodeType === Node.TEXT_NODE) {
          // Direct text usually belongs to rb
          baseText += child.textContent || '';
        }
      }

      // If both base and reading exist, output as 漢字(读音) format
      if (baseText && readingText) {
        return `${baseText}(${readingText})`;
      }
      return baseText || readingText;
    }

    // For other elements, recursively process child nodes
    let result = '';
    for (const child of Array.from(element.childNodes)) {
      result += extractTextWithRuby(child);

      // Add newline after <br> tags
      if (child.nodeType === Node.ELEMENT_NODE) {
        const childTag = (child as Element).tagName.toLowerCase();
        if (childTag === 'br') {
          result += '\n';
        }
      }
    }

    // Add newline after block elements to preserve paragraph structure
    if (isBlock && result.trim()) {
      result += '\n';
    }

    return result;
  }

  return '';
}

export async function parseEPUB(file: File): Promise<{ content: string; title: string; author: string; coverImage?: string; chapters: Chapter[] }> {
  const epubjs = await import('epubjs');
  const book = epubjs.default() as unknown as EPUBBook;

  const arrayBuffer = await file.arrayBuffer();
  await book.open(arrayBuffer);
  await (book as unknown as { ready: Promise<void> }).ready;

  const metadata = await (book.loaded as any).metadata || {};

  // book.loaded.spine is a Promise, must await it
  const spine = await book.loaded.spine;
  console.log('[parseEPUB] spine type:', typeof spine, 'keys:', Object.keys(spine || {}));

  const spineItems: Array<{ href: string; index: number }> = [];
  try {
    // In epubjs 0.3.x, spine has a `Spine` object with `items` array
    const spineObj = spine as unknown as { items?: Array<{ href: string }> };
    console.log('[parseEPUB] spine items:', spineObj.items?.length);
    if (spineObj.items && spineObj.items.length > 0) {
      spineItems.push(...spineObj.items.map((item, i) => ({ href: item.href, index: i })));
    }
  } catch (e) {
    console.log('[parseEPUB] spine error:', e);
  }

  // Try to read TOC/navigation from EPUB
  let tocChapters: Array<{ href: string; title: string; subitems?: any[] }> = [];
  try {
    const navigation = await (book as any).loaded?.navigation;
    if (navigation?.toc && navigation.toc.length > 0) {
      tocChapters = navigation.toc;
      console.log('[parseEPUB] NAV TOC found:', tocChapters.length);
    }
  } catch (e) {
    console.log('[parseEPUB] NAV read error:', e);
  }

  // === FIX: Also try NCX format (many EPUBs use old NCX instead of NAV) ===
  if (tocChapters.length === 0) {
    try {
      const nav2 = (book as any).navigation;
      if (nav2?.toc && nav2.toc.length > 0) {
        tocChapters = nav2.toc;
        console.log('[parseEPUB] NCX/book.navigation TOC found:', tocChapters.length);
      }
    } catch (e) {
      console.log('[parseEPUB] book.navigation read error:', e);
    }
  }

  // Last resort: try to read toc.ncx directly from archive
  if (tocChapters.length === 0) {
    try {
      const packaging = (book as any).packaging || {};
      const ncxPath = packaging?.ncxPath || packaging?.spine?.toc || (book as any).spine?.toc;
      if (ncxPath && book.archive) {
        const ncxUrl = await book.archive.createUrl(ncxPath);
        let ncxText = await fetch(ncxUrl).then(r => r.text());

        console.log('[parseEPUB] NCX raw text length:', ncxText.length);
        console.log('[parseEPUB] NCX first 200 chars:', ncxText.substring(0, 200));

        // === FIX: Strip XML namespace prefixes before DOM parsing ===
        ncxText = ncxText
          .replace(/<([a-zA-Z][a-zA-Z0-9]*):/g, '<')
          .replace(/<\/([a-zA-Z][a-zA-Z0-9]*):/g, '</')
          .replace(/\sxmlns[^=]*="[^"]*"/g, '')
          .replace(/\sxmlns:[a-zA-Z]+="[^"]*"/g, '');

        const parser = new DOMParser();
        const ncxDoc = parser.parseFromString(ncxText, 'application/xml');

        // Check for parse errors
        const parseError = ncxDoc.querySelector('parsererror');
        if (parseError) {
          console.log('[parseEPUB] NCX DOM parse error:', parseError.textContent?.substring(0, 200));
        }

        function parseNavPoint(point: Element): { href: string; title: string; subitems?: any[] } {
          const contents = point.getElementsByTagName('content');
          const texts = point.getElementsByTagName('text');
          const href = contents[0]?.getAttribute('src') || '';
          let title = texts[0]?.textContent || '';

          // Fallback: try navLabel/text structure
          if (!title) {
            const navLabels = point.getElementsByTagName('navLabel');
            if (navLabels.length > 0) {
              const labelTexts = navLabels[0].getElementsByTagName('text');
              if (labelTexts.length > 0) {
                title = labelTexts[0].textContent || '';
              }
            }
          }

          const subitems: any[] = [];
          const childPoints = point.getElementsByTagName('navPoint');
          const directChildren = Array.from(childPoints).filter(np => np.parentElement === point);
          directChildren.forEach(child => {
            subitems.push(parseNavPoint(child));
          });

          return { href, title: title.trim(), subitems: subitems.length > 0 ? subitems : undefined };
        }

        // Get top-level navPoints (direct children of navMap)
        const navMaps = ncxDoc.getElementsByTagName('navMap');
        console.log('[parseEPUB] navMap count:', navMaps.length);

        if (navMaps.length > 0) {
          const navMap = navMaps[0];
          const allNavPoints = Array.from(navMap.getElementsByTagName('navPoint')).filter(np => np.parentElement === navMap);
          console.log('[parseEPUB] Top-level navPoints:', allNavPoints.length);

          allNavPoints.forEach(point => {
            tocChapters.push(parseNavPoint(point));
          });
          console.log('[parseEPUB] NCX parse successful:', tocChapters.length, 'chapters');
          if (tocChapters.length > 0) {
            console.log('[parseEPUB] First 3 chapters:', tocChapters.slice(0, 3).map(c => ({ href: c.href, title: c.title })));
          }
        }
      }
    } catch (e) {
      console.log('[parseEPUB] NCX manual parse error:', e);
    }
  }

  // If still no TOC, try to find and parse a TOC HTML page from spine items
  if (tocChapters.length === 0) {
    console.log('[parseEPUB] Trying to find TOC HTML page...');
    for (const item of spineItems) {
      const lowerHref = item.href.toLowerCase();
      // Look for files with toc/nav in name
      if (!lowerHref.includes('toc') && !lowerHref.includes('nav') && !lowerHref.includes('contents')) {
        continue;
      }

      try {
        const doc = await book.load(item.href) as Document;
        const body = doc.body || doc.documentElement;
        const links = body.querySelectorAll('a');

        // A TOC page should have many links
        if (links.length < 3) continue;

        console.log('[parseEPUB] Found TOC HTML page:', item.href, 'with', links.length, 'links');

        // Extract chapter links and titles
        Array.from(links).forEach(link => {
          const href = link.getAttribute('href');
          const title = link.textContent?.trim();
          if (href && title && title.length > 0 && title.length < 200) {
            // Filter out links to non-content pages
            const lowerLinkHref = href.toLowerCase();
            if (!lowerLinkHref.includes('cover') && !lowerLinkHref.includes('copyright')) {
              tocChapters.push({ href, title });
            }
          }
        });

        if (tocChapters.length > 0) {
          console.log('[parseEPUB] Extracted', tocChapters.length, 'chapters from TOC page');
          break;
        }
      } catch (e) {
        console.log('[parseEPUB] TOC page parse error:', item.href, e);
      }
    }
  }

  const chapters: Chapter[] = [];
  let fullContent = '';
  let currentIndex = 0;
  let coverImage: string | undefined;

  // Try to extract cover image and convert to base64 for persistence
  try {
    const cover = await book.loaded.cover;
    if (cover && book.archive) {
      const coverUrl = await book.archive.createUrl(cover);
      coverImage = await blobToBase64(coverUrl);
    }
  } catch {
    // Cover extraction failed, try alternative method
  }

  // If no cover found, try to find it in the manifest
  if (!coverImage) {
    try {
      const manifest = book.manifest;
      if (manifest) {
        for (const item of Object.values(manifest)) {
          const href = item.href;
          if (href && (item.properties?.includes('cover-image') || href.toLowerCase().includes('cover'))) {
            if (book.archive) {
              const coverUrl = await book.archive.createUrl(href);
              coverImage = await blobToBase64(coverUrl);
            }
            break;
          }
        }
      }
    } catch {
      // Alternative cover detection failed
    }
  }

  try {
    console.log('[parseEPUB] spine items count:', spineItems.length, 'toc chapters:', tocChapters.length);

    // Helper to find spine item by href (handle anchors like chapter1.xhtml#section1)
    const findSpineItem = (href: string): typeof spineItems[0] | undefined => {
      const baseHref = href.split('#')[0];

      // Normalize: remove leading slash, common prefixes
      const normalize = (path: string) => {
        return path
          .replace(/^\//, '')
          .replace(/^OEBPS\//, '')
          .replace(/^OPS\//, '')
          .replace(/\.\.\//g, '');  // Remove ../ relative path prefixes
      };

      const normHref = normalize(baseHref);

      return spineItems.find(item => {
        const normItem = normalize(item.href);
        return normItem === normHref ||
               normItem.endsWith('/' + normHref) ||
               normHref.endsWith('/' + normItem);
      });
    };

    // If we have TOC chapters, use them to drive chapter selection
    if (tocChapters.length > 0) {
      // Flatten TOC with subitems
      function flattenTOC(items: Array<{ href: string; title: string; subitems?: any[] }>): Array<{ href: string; title: string }> {
        const result: Array<{ href: string; title: string }> = [];
        for (const item of items) {
          result.push({ href: item.href, title: item.title });
          if (item.subitems && item.subitems.length > 0) {
            result.push(...flattenTOC(item.subitems));
          }
        }
        return result;
      }

      let flatTocChapters = flattenTOC(tocChapters);
      console.log('[parseEPUB] Flattened TOC chapters:', flatTocChapters.length);

      // === FIX: Only discard TOC if MOST flattened entries are empty ===
      const emptyTitleCount = flatTocChapters.filter(c => !c.title || c.title.trim() === '').length;
      if (emptyTitleCount > flatTocChapters.length * 0.5) {
        console.log('[parseEPUB] Too many empty titles after flattening:', emptyTitleCount, '/', flatTocChapters.length, '- using fallback');
        tocChapters = []; // Will trigger fallback below
      }

      const usedHrefs = new Set<string>();

      for (const tocItem of flatTocChapters) {
        const spineItem = findSpineItem(tocItem.href);
        if (!spineItem) {
          console.log('[parseEPUB] TOC item has no matching spine:', tocItem.href, tocItem.title);
          continue;
        }

        // Fix: use href+anchor as unique key to avoid losing chapters with same spine but different anchors
        const uniqueKey = spineItem.href + (tocItem.href.includes('#') ? '#' + tocItem.href.split('#')[1] : '');
        if (usedHrefs.has(uniqueKey)) continue;
        usedHrefs.add(uniqueKey);

        try {
          const doc = await book.load(spineItem.href) as Document;
          const body = doc.body || doc.documentElement;

          // Skip non-content chapters
          if (isNonContentChapter(spineItem.href, body)) {
            console.log('[parseEPUB] SKIP (isNonContent):', spineItem.href);
            continue;
          }

          const text = extractTextWithRuby(body).trim();
          const cleanText = text
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          if (cleanText && cleanText.length > 50) {
            // Enhanced heading extraction: try multiple sources
            let headingEl = body.querySelector('h1, h2, h3');
            if (!headingEl) headingEl = doc.querySelector('title');
            if (!headingEl) headingEl = body.querySelector('[class*="title"], [class*="chapter"], [id*="title"], [id*="chapter"]');
            if (!headingEl) headingEl = body.querySelector('strong, em, b');

            // If still no heading, try first short line of text as title
            let extractedTitle = headingEl?.textContent?.trim() || '';
            if (!extractedTitle) {
              const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
              const firstLine = lines[0] || '';
              if (firstLine.length > 0 && firstLine.length < 50) {
                extractedTitle = firstLine;
              }
            }

            chapters.push({
              id: generateId(),
              title: tocItem.title?.trim() || extractedTitle || tocItem.href.split('#')[0],
              content: cleanText,
              startIndex: currentIndex,
              endIndex: currentIndex + cleanText.length
            });

            fullContent += cleanText + '\n\n';
            currentIndex = fullContent.length;
          }
        } catch (e) {
          console.log('[parseEPUB] LOAD ERROR:', spineItem.href, e);
        }
      }

      // Always append remaining spine items not covered by TOC
      // Only skip by filename patterns, don't re-run full isNonContentChapter
      for (const item of spineItems) {
        const uniqueKey = item.href + (item.href.includes('#') ? '#' + item.href.split('#')[1] : '');
        if (usedHrefs.has(uniqueKey)) continue;

        const lowerHref = item.href.toLowerCase();
        const isNonContentFile = ['cover', 'toc', 'nav', 'contents'].some(p => lowerHref.includes(p));
        if (isNonContentFile) continue;

          try {
            const doc = await book.load(item.href) as Document;
            const body = doc.body || doc.documentElement;
            const text = extractTextWithRuby(body).trim();
            const cleanText = text
              .replace(/[ \t]+/g, ' ')
              .replace(/\n{3,}/g, '\n\n')
              .trim();

            if (cleanText && cleanText.length > 50) {
              // Enhanced heading extraction for remaining items
              let headingEl = body.querySelector('h1, h2, h3');
              if (!headingEl) headingEl = doc.querySelector('title');
              if (!headingEl) headingEl = body.querySelector('[class*="title"], [class*="chapter"], [id*="title"], [id*="chapter"]');
              if (!headingEl) headingEl = body.querySelector('strong, em, b');

              let extractedTitle = headingEl?.textContent?.trim() || '';
              if (!extractedTitle) {
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                const firstLine = lines[0] || '';
                if (firstLine.length > 0 && firstLine.length < 50) {
                  extractedTitle = firstLine;
                }
              }

              chapters.push({
                id: generateId(),
                title: extractedTitle || item.href,
                content: cleanText,
                startIndex: currentIndex,
                endIndex: currentIndex + cleanText.length
              });
              fullContent += cleanText + '\n\n';
              currentIndex = fullContent.length;
            }
          } catch (e) {
            console.log('[parseEPUB] Remaining item load error:', item.href, e);
          }
        }
    } else {
      // Fallback: merge all spine items, then auto-split by headings
      console.log('[parseEPUB] No TOC found, merging spine items and splitting by headings');

      const mergedSections: Array<{ title: string; content: string }> = [];
      let currentSection = { title: '', content: '' };

      for (const item of spineItems) {
        try {
          const doc = await book.load(item.href) as Document;
          const body = doc.body || doc.documentElement;

          if (isNonContentChapter(item.href, body)) continue;

          const text = extractTextWithRuby(body).trim();
          const cleanText = text
            .replace(/[ \t]+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          if (!cleanText || cleanText.length < 30) continue;

          // Check for heading in this spine item
          const headingEl = body.querySelector('h1, h2, h3');
          let headingText = headingEl?.textContent?.trim();

          // If no HTML heading, try regex for chapter titles in first 300 chars
          if (!headingText) {
            const sample = cleanText.substring(0, 300);
            const chapterMatch = sample.match(/(序[章編]?|[終]章|Prologue|Epilogue|[第][一二三四五六七八九十百千万\d\s]+[章編節回話]|[Cc]hapter\s*\d+)/);
            if (chapterMatch) {
              headingText = chapterMatch[0];
            }
          }

          if (headingText && headingText.length > 0 && headingText.length < 200) {
            // Save previous section if exists
            if (currentSection.content) {
              mergedSections.push({ ...currentSection });
            }
            // Start new section
            currentSection = {
              title: headingText,
              content: cleanText
            };
          } else {
            // === FIX: Don't merge all spine items into one section ===
            // Save current section if exists
            if (currentSection.content) {
              mergedSections.push({ ...currentSection });
            }
            // Start new section for this spine item
            currentSection = {
              title: '', // Will use index-based title later
              content: cleanText
            };
          }
        } catch (e) {
          console.log('[parseEPUB] LOAD ERROR:', item.href, e);
        }
      }

      // Push final section
      if (currentSection.content) {
        mergedSections.push(currentSection);
      }

      // Create chapters from merged sections
      for (const section of mergedSections) {
        if (section.content.length > 50) {
          chapters.push({
            id: generateId(),
            title: section.title || `第${mergedSections.indexOf(section) + 1}章`,
            content: section.content,
            startIndex: currentIndex,
            endIndex: currentIndex + section.content.length
          });
          fullContent += section.content + '\n\n';
          currentIndex = fullContent.length;
        }
      }

      console.log('[parseEPUB] Auto-split into', chapters.length, 'chapters');
    }
    console.log('[parseEPUB] Total chapters parsed:', chapters.length, 'fullContent length:', fullContent.length);
    console.log('[parseEPUB] Final chapters:', chapters.map(c => ({ title: c.title, len: c.content.length })));
  } catch (e) {
    console.log('[parseEPUB] SPINE ERROR:', e);
    // Fallback: book uses different structure
  }

  // Fallback if no content
  if (!fullContent) {
    fullContent = 'Unable to parse EPUB content. Please try a different file or format.';
    console.log('[parseEPUB] No content extracted!');
  }

  return {
    content: fullContent,
    title: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
    author: extractAuthor(metadata),
    coverImage,
    chapters: chapters.length > 0 ? chapters : [{
      id: generateId(),
      title: 'Content',
      content: fullContent,
      startIndex: 0,
      endIndex: fullContent.length
    }]
  };
}

export async function parsePDF(file: File): Promise<{ content: string; title: string; author: string; chapters: Chapter[] }> {
  const pdfjs = await import('pdfjs-dist');

  pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

  let fullContent = '';
  const numPages = pdf.numPages;
  const chapterTexts: string[] = [];
  const PAGES_PER_CHAPTER = 20;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = (textContent.items as Array<{ str?: string }>)
      .map((item) => item.str || '')
      .join(' ');
    fullContent += pageText + '\n\n';
    chapterTexts.push(pageText);
  }

  // Split pages into chapters
  const chapters: Chapter[] = [];
  for (let i = 0; i < chapterTexts.length; i += PAGES_PER_CHAPTER) {
    const chunk = chapterTexts.slice(i, i + PAGES_PER_CHAPTER).join('\n\n');
    const startPage = i + 1;
    const endPage = Math.min(i + PAGES_PER_CHAPTER, numPages);
    chapters.push({
      id: generateId(),
      title: `Page ${startPage}-${endPage}`,
      content: chunk,
      startIndex: 0,
      endIndex: chunk.length
    });
  }

  return {
    content: fullContent || 'Unable to parse PDF content.',
    title: file.name.replace(/\.pdf$/i, ''),
    author: 'Unknown',
    chapters
  };
}

export async function parseMOBI(file: File): Promise<{ content: string; title: string; author: string; coverImage?: string; chapters: Chapter[] }> {
  const mobi = await initMobiFile(file);
  const metadata = mobi.getMetadata();
  const spine = mobi.getSpine();

  const chapters: Chapter[] = [];
  let fullContent = '';
  let currentIndex = 0;

  for (const chapter of spine) {
    const processed = mobi.loadChapter(chapter.id);
    if (processed) {
      // Strip HTML tags to get plain text
      const text = processed.html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (text.length > 50) {
        chapters.push({
          id: chapter.id,
          title: chapter.text
            ?.replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 50) || `Chapter ${chapters.length + 1}`,
          content: text,
          startIndex: currentIndex,
          endIndex: currentIndex + text.length
        });
        fullContent += text + '\n\n';
        currentIndex = fullContent.length;
      }
    }
  }

  let coverImage: string | undefined;
  try {
    const rawCover = mobi.getCoverImage() as unknown;
    if (rawCover) {
      if (typeof rawCover === 'string') {
        coverImage = rawCover;
      } else if (rawCover instanceof Blob) {
        coverImage = await blobToBase64(URL.createObjectURL(rawCover as Blob));
      } else if (rawCover instanceof ArrayBuffer) {
        const blob = new Blob([rawCover], { type: 'image/jpeg' });
        coverImage = await blobToBase64(URL.createObjectURL(blob));
      } else if (typeof rawCover === 'object' && (rawCover as { buffer?: ArrayBuffer }).buffer) {
        const buf = (rawCover as { buffer: ArrayBuffer }).buffer;
        const blob = new Blob([buf], { type: 'image/jpeg' });
        coverImage = await blobToBase64(URL.createObjectURL(blob));
      }
    }
  } catch {
    // No cover
  }

  return {
    content: fullContent || 'Unable to parse MOBI content.',
    title: metadata.title || file.name.replace(/\.(mobi|azw3)$/i, ''),
    author: (metadata.author || []).join(', ') || 'Unknown',
    coverImage,
    chapters: chapters.length > 0 ? chapters : [{
      id: generateId(),
      title: 'Content',
      content: fullContent,
      startIndex: 0,
      endIndex: fullContent.length
    }]
  };
}

export async function parseAZW3(file: File): Promise<{ content: string; title: string; author: string; coverImage?: string; chapters: Chapter[] }> {
  return parseMOBI(file);
}

export async function parseBook(file: File): Promise<Book> {
  const filename = file.name.toLowerCase();
  const format = filename.endsWith('.epub')
    ? 'epub'
    : filename.endsWith('.pdf')
    ? 'pdf'
    : filename.endsWith('.mobi')
    ? 'mobi'
    : filename.endsWith('.azw3')
    ? 'azw3'
    : 'txt';

  let result: {
    content: string;
    title: string;
    author?: string;
    coverImage?: string;
    chapters?: Chapter[];
  };

  switch (format) {
    case 'epub':
      result = await parseEPUB(file);
      break;
    case 'pdf':
      // Check PDF file size - if > 10MB, warn user
      if (file.size > 10 * 1024 * 1024) {
        throw new Error('PDF_TOO_LARGE');
      }
      result = await parsePDF(file);
      // Sanity check: ensure parsed content is not empty
      if (!result.content || result.content.trim().length < 100) {
        throw new Error('PDF_EMPTY_CONTENT');
      }
      break;
    case 'mobi':
      result = await parseMOBI(file);
      break;
    case 'azw3':
      result = await parseAZW3(file);
      // AZW3 fallback: if empty content, try parsing as MOBI
      if (!result.content || result.content.trim().length < 100) {
        console.warn('[parseBook] AZW3 returned empty, retrying as MOBI...');
        result = await parseMOBI(file);
      }
      if (!result.content || result.content.trim().length < 100) {
        throw new Error('AZW3_EMPTY_CONTENT');
      }
      break;
    default:
      result = await parseTextFile(file);
  }

  const language = detectLanguage(file.name, result.content);
  const wordCount = result.content.replace(/\s+/g, ' ').split(' ').filter(Boolean).length;

  return {
    id: generateId(),
    title: result.title,
    author: result.author || 'Unknown',
    language,
    format,
    content: result.content,
    coverImage: result.coverImage,
    progress: 0,
    lastReadAt: new Date(),
    addedAt: new Date(),
    totalWords: wordCount,
    chapters: result.chapters,
    translations: {},
    translationStatus: {
      totalParagraphs: 0,
      translatedParagraphs: 0
    }
  };
}

export function chunkContent(content: string, chunkSize: number = 500): string[] {
  const paragraphs = content.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if ((currentChunk + para).length > chunkSize && currentChunk) {
      chunks.push(currentChunk.trim());
      currentChunk = '';
    }
    currentChunk += para + '\n\n';
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks;
}

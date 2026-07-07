// URL Scraper - Extract article text from web pages
// Uses cheerio to parse HTML and extract article content
// Implements AMP fallback for JavaScript-rendered sites

import * as cheerio from "cheerio";

/**
 * Validate URL format
 * @param {string} url
 * @returns {boolean}
 */
const isValidUrl = (url) => {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Construct AMP URL from original URL
 * Supports various Indonesian news sites
 * @param {string} url
 * @returns {string|null}
 */
const AMP_SITES = [
  "jawapos.com",
  "detik.com",
  "kompas.com",
  "tribunnews.com",
  "sindonews.com",
  "republika.co.id",
  "merdeka.com",
  "cnnindonesia.com",
  "jpnn.com",
];

const constructAmpUrl = (url) => {
  try {
    const parsed = new URL(url);
    const cleanPath = parsed.pathname.replace(/^\/amp\//, "");
    parsed.pathname = "/amp" + cleanPath;
    return parsed.toString();
  } catch {
    return null;
  }
};

/**
 * Extract article text from HTML using cheerio
 * @param {string} html
 * @param {string} url - Original URL for context
 * @returns {{text: string, title: string}}
 */
const extractArticleText = (html, url) => {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $(
    "script, style, nav, header, footer, aside, .ads, .advertisement, .sidebar, .menu, .navigation, .comments, .social-share, .related-articles, .breadcrumb, .breaking-news, .breaking, .breaking-banner",
  ).remove();

  // Extract title
  let title =
    $("h1").first().text().trim() ||
    $("title").text().trim() ||
    $("h2").first().text().trim() ||
    "";

  // Try AMP-specific selectors first (AMP pages have specific structure)
  const ampSelectors = [
    "article.content",
    "article.post-content",
    ".amp-content",
    ".amp-article",
    ".story-body",
    ".article-body",
  ];

  // Common article content selectors (priority order)
  const articleSelectors = [
    "article",
    '[role="article"]',
    ".article-content",
    ".article-body",
    ".post-content",
    ".entry-content",
    ".content-body",
    ".story-content",
    ".berita-content",
    ".news-content",
    ".main-content",
    "main",
    "#article",
    "#content",
    ".content",
    ".amp-wp-content", // WordPress AMP
    ".amp-entry-content", // WordPress AMP alternative
  ];

  let articleText = "";

  // Try AMP-specific selectors first
  for (const selector of ampSelectors) {
    const element = $(selector);
    if (element.length > 0) {
      const paragraphs = element.find("p");
      if (paragraphs.length > 0) {
        articleText = paragraphs
          .map((_, el) => $(el).text().trim())
          .get()
          .filter((text) => text.length > 20)
          .join("\n\n");

        if (articleText.length > 200) break;
      }
    }
  }

  // Try standard selectors
  if (!articleText || articleText.length < 200) {
    for (const selector of articleSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        const paragraphs = element.find("p, h2, h3, h4, li, blockquote");
        if (paragraphs.length > 0) {
          articleText = paragraphs
            .map((_, el) => $(el).text().trim())
            .get()
            .filter((text) => text.length > 20)
            .join("\n\n");

          if (articleText.length > 200) break;
        }
      }
    }
  }

  // Fallback: get all paragraph-like content from body
  if (!articleText || articleText.length < 200) {
    const allContent = $("p, h2, h3, h4, li, blockquote")
      .map((_, el) => $(el).text().trim())
      .get()
      .filter((text) => text.length > 30)
      .join("\n\n");

    if (allContent.length > articleText.length) {
      articleText = allContent;
    }
  }

  return { text: articleText, title };
};

/**
 * Extract Open Graph description as fallback
 * @param {string} html
 * @returns {string|null}
 */
const extractOgDescription = (html) => {
  const $ = cheerio.load(html);
  const ogDesc = $('meta[property="og:description"]').attr("content");
  const metaDesc = $('meta[name="description"]').attr("content");
  return ogDesc || metaDesc || null;
};

/**
 * Fetch HTML from a URL with standard headers
 * @param {string} url
 * @returns {Promise<string>}
 */
const fetchHtml = async (url) => {
  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) {
    throw new Error("Not HTML");
  }

  return response.text();
};

/**
 * Fetch article content from URL with AMP fallback
 * @param {string} url - The URL to fetch
 * @returns {Promise<{text: string, title: string, domain: string}>}
 * @throws {Error} - If URL is invalid, fetch fails, or no content extracted
 */
export const fetchArticleFromUrl = async (url) => {
  // Validate URL
  if (!url || !url.trim()) {
    throw new Error("URL tidak boleh kosong.");
  }

  if (!isValidUrl(url)) {
    throw new Error(
      "URL tidak valid. Pastikan URL dimulai dengan http:// atau https://",
    );
  }

  const parsed = new URL(url);
  const domain = parsed.hostname.replace("www.", "");

  try {
    // Step 1: Try to fetch main URL
    let html = await fetchHtml(url);
    let extracted = extractArticleText(html, url);

    // Check if we got meaningful content
    if (extracted.text && extracted.text.length >= 100) {
      return {
        text: extracted.text,
        title: extracted.title,
        domain: domain,
      };
    }

    // Step 2: Main URL didn't have full content, try AMP version
    const ampUrl = constructAmpUrl(url);
    if (ampUrl && ampUrl !== url) {
      try {
        html = await fetchHtml(ampUrl);
        extracted = extractArticleText(html, ampUrl);

        if (extracted.text && extracted.text.length >= 100) {
          return {
            text: extracted.text,
            title: extracted.title,
            domain: domain,
          };
        }
      } catch {
        // AMP fetch failed, continue to fallback
      }
    }

    // Step 3: Try to get og:description as last resort
    const ogDesc = extractOgDescription(html);
    if (ogDesc && ogDesc.length > 50) {
      // Return OG description with a note that this is a partial extraction
      return {
        text: `[Cuplikan artikel - konten lengkap memerlukan JavaScript rendering]\n\n${ogDesc}`,
        title: extracted.title,
        domain: domain,
      };
    }

    // All methods failed
    throw new Error(
      "Tidak dapat mengekstrak artikel dari halaman ini. Website mungkin menggunakan konten JavaScript yang tidak bisa di-ekstrak.",
    );
  } catch (error) {
    if (error.name === "AbortError" || error.message.includes("timeout")) {
      throw new Error("Waktu habis. URL terlalu lambat untuk diakses.");
    }

    if (
      error.message.includes("fetch failed") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND")
    ) {
      throw new Error(
        "Tidak dapat terhubung ke website ini. Pastikan URL benar dan website dapat diakses.",
      );
    }

    // Re-throw our custom errors
    throw error;
  }
};

export default fetchArticleFromUrl;

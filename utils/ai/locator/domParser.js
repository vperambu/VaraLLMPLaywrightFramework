/**
 * ═══════════════════════════════════════════════════════════════════
 * utils/ai/locator/domParser.js — DOM/WAI-ARIA Snapshot Parser
 *
 * Uses Playwright's accessibility.snapshot() to get the WAI-ARIA tree,
 * then flattens it into a list of interactable elements with metadata.
 *
 * Usage (run against a live page in a Playwright context):
 *   const { parseDomSnapshot } = await import('./domParser.js');
 *   const elements = await parseDomSnapshot(page);
 * ═══════════════════════════════════════════════════════════════════
 */

/**
 * @typedef {Object} ParsedElement
 * @property {string}  role          - ARIA role (button, link, textbox, etc.)
 * @property {string}  name          - Accessible name
 * @property {string}  testId        - data-testid attribute (if present)
 * @property {string}  placeholder   - Input placeholder text
 * @property {string}  level         - Heading level (for headings)
 * @property {boolean} isInteractable
 * @property {string}  suggestedLocator - Best Playwright locator string
 * @property {string}  locatorType   - 'getByRole' | 'getByTestId' | 'getByLabel' | 'getByText'
 */

/** Roles that represent interactable UI elements */
const INTERACTABLE_ROLES = new Set([
  'button', 'link', 'textbox', 'combobox', 'checkbox', 'radio',
  'menuitem', 'tab', 'searchbox', 'spinbutton', 'slider',
  'switch', 'option', 'treeitem', 'columnheader',
]);

/**
 * Captures and parses the WAI-ARIA accessibility tree from a live Playwright page.
 * @param {import('playwright').Page} page
 * @returns {Promise<ParsedElement[]>}
 */
export async function parseDomSnapshot(page) {
  const snapshot = await page.accessibility.snapshot({ interestingOnly: true });
  if (!snapshot) return [];

  const elements = [];
  _walkTree(snapshot, elements);
  return elements;
}

/**
 * Parses a pre-captured serialized accessibility snapshot JSON.
 * Useful for offline analysis without a live browser.
 * @param {object} snapshot - From page.accessibility.snapshot()
 * @returns {ParsedElement[]}
 */
export function parseStaticSnapshot(snapshot) {
  const elements = [];
  _walkTree(snapshot, elements);
  return elements;
}

/**
 * Extracts all data-testid attributes from the live DOM.
 * These are not captured in the accessibility tree.
 * @param {import('playwright').Page} page
 * @returns {Promise<Array<{testId: string, tag: string, text: string}>>}
 */
export async function extractTestIds(page) {
  return page.evaluate(() => {
    const elements = document.querySelectorAll('[data-testid]');
    return Array.from(elements).map((el) => ({
      testId: el.getAttribute('data-testid'),
      tag: el.tagName.toLowerCase(),
      text: el.innerText?.substring(0, 80) || '',
      ariaLabel: el.getAttribute('aria-label') || '',
    }));
  });
}

/**
 * Merges aria tree elements with testid elements into a unified list.
 * @param {import('playwright').Page} page
 * @returns {Promise<ParsedElement[]>}
 */
export async function getFullElementMap(page) {
  const [ariaElements, testIdElements] = await Promise.all([
    parseDomSnapshot(page),
    extractTestIds(page),
  ]);

  // Build a map of testId → element for merging
  const testIdMap = new Map(testIdElements.map((el) => [el.ariaLabel || el.text, el.testId]));

  // Enrich aria elements with testIds where label text matches
  return ariaElements.map((el) => {
    const matchedTestId = testIdMap.get(el.name) || el.testId;
    if (matchedTestId && !el.testId) {
      return {
        ...el,
        testId: matchedTestId,
        suggestedLocator: `page.getByTestId('${matchedTestId}')`,
        locatorType: 'getByTestId',
      };
    }
    return el;
  });
}

// ════════════════════════════════════════════════════════════════════
// Private — Tree Walker
// ════════════════════════════════════════════════════════════════════

function _walkTree(node, results, depth = 0) {
  if (!node || typeof node !== 'object') return;

  if (node.role && node.role !== 'RootWebArea') {
    const parsed = _parseNode(node, depth);
    if (parsed) results.push(parsed);
  }

  if (node.children) {
    for (const child of node.children) {
      _walkTree(child, results, depth + 1);
    }
  }
}

function _parseNode(node, depth) {
  const { role, name, value, description, level } = node;

  if (!role || !name) return null;

  const isInteractable = INTERACTABLE_ROLES.has(role.toLowerCase());

  // Build the best locator based on priority
  const { locatorType, suggestedLocator } = _buildLocator(role, name, level, node);

  return {
    role: role.toLowerCase(),
    name: name || '',
    value: value || '',
    description: description || '',
    level: level || null,
    testId: node.testId || null,
    placeholder: node.placeholder || null,
    isInteractable,
    depth,
    locatorType,
    suggestedLocator,
  };
}

function _buildLocator(role, name, level, node) {
  const sanitizedName = name.replace(/'/g, "\\'");

  // Priority 1: getByRole (most reliable)
  if (INTERACTABLE_ROLES.has(role.toLowerCase()) && name) {
    const roleStr = role.toLowerCase();
    const nameOpt = level ? `, { name: '${sanitizedName}', level: ${level} }` : `, { name: '${sanitizedName}' }`;
    return {
      locatorType: 'getByRole',
      suggestedLocator: `page.getByRole('${roleStr}'${nameOpt})`,
    };
  }

  // Priority 2: getByTestId
  if (node.testId) {
    return {
      locatorType: 'getByTestId',
      suggestedLocator: `page.getByTestId('${node.testId}')`,
    };
  }

  // Priority 3: getByLabel (form elements)
  if (['textbox', 'combobox', 'searchbox', 'spinbutton'].includes(role.toLowerCase()) && name) {
    return {
      locatorType: 'getByLabel',
      suggestedLocator: `page.getByLabel('${sanitizedName}')`,
    };
  }

  // Priority 4: getByText (static content)
  if (name) {
    return {
      locatorType: 'getByText',
      suggestedLocator: `page.getByText('${sanitizedName}')`,
    };
  }

  return {
    locatorType: 'unknown',
    suggestedLocator: `// No reliable locator found for role="${role}" name="${name}"`,
  };
}

document.addEventListener(
  "dblclick",
  (event) => {
    const currentElement = /** @type {HTMLElement} */ (event.target);

    // Only activate when on the results view
    if (!childHasDescendant("#results-view-content", currentElement))
      return;

    if (currentElement.tagName.toLowerCase() !== "span")
      return;

    // Prevent multiple modals from being created
    const modalId = "custom-modal-overlay";
    if (document.getElementById(modalId))
      return;

    // Determine the content to show
    let contentText = currentElement.innerText.trim() || "(Empty span)";

    showModal(contentText);

    // Clear any text selection that might have occurred during the double click
    if (window.getSelection) {
      window.getSelection()?.removeAllRanges();
    }
  }
);

const modalTemplate = document.createElement('template');
modalTemplate.innerHTML = `
  <div id="custom-modal-overlay">
    <div id="custom-modal-content">
      <button id="custom-modal-close">Close</button>
      <pre id="modal-message-container"><code id="modal-message-code"></code></pre>
    </div>
  </div>
`;

/**
 * @param {string} contentText
 */
function showModal(contentText) {
  // Clone the template content
  const modalClone = modalTemplate.content.cloneNode(true);
  const modalOverlay = modalClone.querySelector('#custom-modal-overlay');

  const formatter = new StackTraceFormatter({
    searchQuery: "",
    hideFilePath: true,
    groupEnabled: true,
    hideNamespaces: ["System.*", "Microsoft.*"],
  });

  let parsedObject = tryParseJson(contentText);

  if (formatter.isAppInsightsPayload(parsedObject) || formatter.isJsonExceptionPayload(parsedObject)) {
    const modalMessageContainer = modalOverlay.querySelector('#modal-message-container');

    let formattedHtml = formatter.formatStackTrace(contentText);

    modalMessageContainer.innerHTML = formattedHtml;
  }
  else {
    const modalMessageCode = modalOverlay.querySelector('#modal-message-code');
    modalMessageCode.classList.add('language-json');

    let parsedString = parsedObject === null ? contentText : JSON.stringify(parsedObject, null, 2);

    if (!parsedObject) {
      // If parsing fails, simply display the original string.
      modalMessageCode.textContent = parsedString;
      return;
    }

    // Generate the collapsible HTML from the JSON object.
    //const jsonInHtml = generateCollapsibleJSON(parsedObject);
    // modalMessageCode.innerText = jsonInHtml;

    modalMessageCode.textContent = parsedString;

    // Manually trigger Prism on the new content
    Prism.hooks.add("before-highlight", function (env) {
      // Replace <br> tags with newlines before highlighting
      env.element.innerHTML = env.element.innerHTML.replace(/<br\s*\/?>/gi, '\n');
      env.code = env.element.innerText;
    });
    Prism.highlightElement(modalMessageCode);

    // Attach folding behavior to toggle elements.
    // addCodeFolding();
  }

  // Append the modal to the DOM
  document.body.appendChild(modalOverlay);

  // Set up the close behavior
  modalOverlay.querySelector('#custom-modal-close').addEventListener('click', e => {
    e.stopPropagation();
    modalOverlay.remove();
  });

  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) modalOverlay.remove();
  });
}

/**
 * Checks if a child element has a descendant matching the given selector.
 *
 * @param {string} selector - The CSS selector to search for in descendants.
 * @param {HTMLElement} childElement - The child element to start the search from.
 * @returns {boolean} True if a descendant matching the selector is found, false otherwise.
 */
function childHasDescendant(selector, childElement) {
  return childElement.closest(selector) !== null;
}

/**
 * @param {string} jsonString The JSON string to parse
 * @returns {string} An object or null if parsing fails
 */
function tryParseJson(jsonString) {
  let jsonObj = tryParseJsonHelper(jsonString);

  if (!jsonObj)
    return null;

  return deserializeNestedJSONStrings(jsonObj);
}

/**
 * Recursively deserializes nested JSON strings.
 * @param {object} jsonObject The jsonObject to process.
 * @returns {object} The jsonObject with nested JSON strings deserialized where possible.
 */
const deserializeNestedJSONStrings = (jsonObject) => {
  // If it's not an object (or it's null), return it as is
  if (!isObject(jsonObject))
    return jsonObject;

  // Handle arrays: map over elements
  if (Array.isArray(jsonObject))
    return jsonObject.map(item => deserializeNestedJSONStrings(item));

  // Process objects by iterating over key-value pairs
  return Object.fromEntries(
    Object.entries(jsonObject).map(([key, value]) => {

      if (typeof value === 'string')
        return [key, tryParseJsonHelper(value) || value];

      if (isObject(value))
        return [key, deserializeNestedJSONStrings(value)];

      return [key, value];
    })
  );
};

/**
 * Attempts to parse a string as JSON.
 * @param {string} str The string to parse.
 * @returns {object|undefined} The parsed JSON object if successful, undefined if parsing fails.
 */
const tryParseJsonHelper = (str) => {
  try {
    return JSON.parse(str);
  } catch (e) {
    return undefined;
  }
};

/**
 * Checks if a value is a non-null object.
 * @param {*} val The value to check.
 * @returns {boolean} True if the value is a non-null object, false otherwise.
 */
const isObject = (val) =>
  typeof val === 'object' && val !== null;


// --------------------------------------------------
// Code Folding
// --------------------------------------------------

/**
* Recursively generate an HTML string for JSON with collapsible sections.
* @param {any} data - The JSON data (object, array, or primitive).
* @param {number} indentLevel - Current level of indentation for formatting.
* @returns {string} - HTML string with embedded spans for toggling.
*/
function generateCollapsibleJSON(data, indentLevel = 0) {
  const indent = '  '.repeat(indentLevel);
  // For primitives, return the JSON-stringified value.
  if (typeof data !== 'object' || data === null) {
    return `<span class="json-value">${JSON.stringify(data)}</span>`;
  }
  // Process arrays.
  if (Array.isArray(data)) {
    let html = `${indent}<span class="json-toggle">[</span>\n`;
    html += `${indent}<span class="json-collapsible json-indent">\n`;
    data.forEach((item, index) => {
      html += generateCollapsibleJSON(item, indentLevel + 1);
      if (index < data.length - 1) {
        html += ',';
      }
      html += '\n';
    });
    html += `${indent}</span>]\n`;
    return html;
  }
  // Process objects.
  else {
    let html = `${indent}<span class="json-toggle">{</span>\n`;
    html += `${indent}<span class="json-collapsible json-indent">\n`;
    const keys = Object.keys(data);
    keys.forEach((key, index) => {
      html += `${indent}  <span class="json-key">"${key}"</span>: `;
      html += generateCollapsibleJSON(data[key], indentLevel + 1);
      if (index < keys.length - 1) {
        html += ',';
      }
      html += '\n';
    });
    html += `${indent}</span>}\n`;
    return html;
  }
}

/**
 * Attach click event listeners to elements with the 'json-toggle' class to toggle visibility.
 */
function addCodeFolding() {
  const toggles = document.querySelectorAll('.json-toggle');
  toggles.forEach(toggle => {
    toggle.addEventListener('click', function () {
      const collapsible = this.nextElementSibling;
      if (collapsible) {
        collapsible.classList.toggle('collapsed');
        // Change toggle text as a visual cue.
        if (collapsible.classList.contains('collapsed')) {
          this.textContent = (this.textContent.startsWith('{')) ? '{...}' : '[...]';
        } else {
          this.textContent = (this.textContent.includes('{')) ? '{' : '[';
        }
      }
    });
  });
}
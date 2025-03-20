/**
 * Utility class to format C# stack traces.
 */
class StackTraceFormatter {
    /**
     * @param {Object} [options] - Formatting options.
     * @param {string} [options.searchQuery]
     * @param {boolean} [options.hideFilePath]
     * @param {boolean} [options.groupEnabled]
     * @param {string[]} [options.hideNamespaces] - List of namespaces to hide (supports wildcards).
     */
    constructor({ searchQuery = '', hideFilePath = false, groupEnabled = false, hideNamespaces = [] } = {}) {
        this.searchQuery = searchQuery.trim();
        this.hideFilePath = hideFilePath;
        this.groupEnabled = groupEnabled;
        this.hideNamespaces = hideNamespaces;
        this.hideRegexes = hideNamespaces.map(ns => this.#createNamespaceRegex(ns));
        this.currentGroupNamespace = null;
    }

    /**
     * Formats the entire stack trace
     * @param {string} rawStackTrace
     * @returns {string} Formatted HTML string
     */
    formatStackTrace(rawStackTrace) {
        const normalizedInput = this.#normalizeStackTrace(rawStackTrace);
        const lines = normalizedInput.split('\n');
        let /** @type {string[]} */ outputLines = [];
        this.currentGroupNamespace = null;
        let firstNonStackLine = true;
        const frameRegex = /^\s*at\s+(?<method>.+?)(?:\s+in\s+(?<file>.+?))?(?::line\s+(?<line>\d+))?\s*$/;

        lines.forEach(line => {
            if (!line.trim()) return;
            const match = line.match(frameRegex);
            if (match) {
                this.#processStackLine(match.groups, outputLines);
            } else {
                this.#processNonStackLine(line, firstNonStackLine, outputLines);
                firstNonStackLine = false;
                this.currentGroupNamespace = null;
            }
        });

        return outputLines.join('');
    }

    /**
     * @param {string} pattern
     * @returns {RegExp}
     */
    #createNamespaceRegex(pattern) {
        const escaped = pattern.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*');
        return new RegExp('^' + escaped, 'i');
    }

    /**
     * @param {string} rawInput
     * @returns {string} Normalized stack trace
     */
    #normalizeStackTrace(rawInput) {
        let normalizedStackTrace = rawInput.trim();

        const parsed = this.tryParseJsonHelper(rawInput);
        if (this.isAppInsightsPayload(parsed)) {
            normalizedStackTrace = this.#convertAppInsightsPayloadToStackTrace(parsed);
        }

        if (this.isJsonExceptionPayload(parsed)) {
            normalizedStackTrace = `${parsed.ClassName}: ${parsed.Message}\n${parsed.StackTraceString}`;
        }

        return this.#unescapeHTML(normalizedStackTrace.replace(/\\\\/g, '\\').replace(/\\r\\n/g, "\n"));
    }

    /**
     * @param {string} input
     * @returns {Object|null} Parsed JSON object or null
     */
    tryParseJsonHelper(input) {
        try {
            return JSON.parse(input);
        } catch {
            return null;
        }
    }

    /**
     * @param {Object|null} jsonData
     * @returns {boolean} True if it is an App Insights payload
     */
    isAppInsightsPayload(jsonData) {
        return jsonData
            && ((Array.isArray(jsonData) && jsonData.length > 0 && jsonData[0].parsedStack)
                || (!Array.isArray(jsonData) && typeof jsonData === 'object' && jsonData !== null && jsonData.parsedStack));
    }

    isJsonExceptionPayload(jsonData) {
        return jsonData?.ClassName && jsonData.Message && jsonData.StackTraceString;
    }

    /**
     * @param {Object[]} data - The App Insights payload
     * @returns {string} Converted stack trace
     */
    #convertAppInsightsPayloadToStackTrace(data) {
        data = Array.isArray(data) ? data : [data];

        const lines = data.flatMap(errorItem => {
            const header = `${errorItem.type}: ${errorItem.message}`;
            const frames = Array.isArray(errorItem.parsedStack)
                ? errorItem.parsedStack.map(frame => {
                    let line = "   at " + frame.method;
                    if (frame.fileName) {
                        line += " in " + frame.fileName;
                        if (frame.line && frame.line > 0) {
                            line += ":line " + frame.line;
                        }
                    }
                    return line;
                })
                : [];
            return [header, ...frames];
        });
        return lines.join("\n");
    }

    /**
     * @param {string} str - The HTML string to escape
     * @returns {string}
     */
    #escapeHTML(str) {
        return str.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * @param {string} str - The string to unescape
     * @returns {string}
     */
    #unescapeHTML(str) {
        return str.replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#039;/g, "'");
    }

    /**
     * @param {string} text - The text to search within
     * @returns {string} Text with highlighted matches
     */
    #highlightMatches(text) {
        if (!text)
            return "";

        if (!this.searchQuery)
            return this.linkify(this.#escapeHTML(text));
    
        // Create a regex for the raw search query
        let searchRegex = new RegExp(this.#escapeRegExp(this.searchQuery), 'gi');
    
        // Insert temporary markers around matches
        let markedText = text.replace(searchRegex, match => `__HIGHLIGHT_START__${match}__HIGHLIGHT_END__`);
    
        // Escape the entire text, including our temporary markers
        let escapedText = this.#escapeHTML(markedText);

        // Replace links with anchor tags
        escapedText = this.linkify(escapedText);
    
        // Replace the escaped markers with the actual <mark> tags
        return escapedText
            .replace(/__HIGHLIGHT_START__/g, '<mark>')
            .replace(/__HIGHLIGHT_END__/g, '</mark>');
    }

    /**
    * A linkify function that replaces plain-text URLs with anchor tags
    * @param {string} html - The HTML string to process
    * @returns {string} - The updated HTML string with URLs converted to links
    */
    linkify(html) {
        return html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank">$1</a>');
    }


    /**
     * Escapes RegExp special characters
     * @param {string} string
     * @returns {string} Escaped string
     */
    #escapeRegExp(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * @param {string} fullPath
     * @returns {string}
     */
    #getFileName(fullPath) {
        const parts = fullPath.split(/[/\\]/);
        return parts[parts.length - 1];
    }

    /**
     * @param {string} fullMethod - Full method string (e.g., Namespace.Sub.Class.Method(params)).
     * @returns {Object} Object with `ns` (namespace) and `remainder` (class and method with params).
     */
    #extractNamespaceAndRemainder(fullMethod) {
        const methodWithoutParams = fullMethod.split('(')[0];
        const params = fullMethod.substring(methodWithoutParams.length);
        const parts = methodWithoutParams.split('.');
        if (parts.length > 2) {
            const ns = parts.slice(0, parts.length - 2).join('.');
            const remainder = parts.slice(parts.length - 2).join('.') + params;
            return { ns, remainder };
        } else {
            return { ns: '', remainder: fullMethod };
        }
    }

    /**
     * @param {Object} frameData
     * @param {string[]} outputLines
     */
    #processStackLine(frameData, outputLines) {
        const { method, file, line: lineNumber } = frameData;

        // Skip frames if the method matches any hide namespace regex.
        if (this.hideRegexes.some(regex => regex.test(method))) return;

        if (this.groupEnabled) {
            const { ns, remainder } = this.#extractNamespaceAndRemainder(method);
            if (ns) {
                if (this.currentGroupNamespace !== ns) {
                    this.currentGroupNamespace = ns;
                    outputLines.push(this.#addLineWithIndentation(1, `at <span class="namespace"><strong>${this.#highlightMatches(ns)}</strong></span>:`));
                }
                const content = `<span class="method">${this.#highlightMatches(remainder)}</span>` +
                    this.#formatFileAndLine(file, lineNumber);
                outputLines.push(this.#addLineWithIndentation(2, content));
                return;
            }
        }
        this.currentGroupNamespace = null;
        const content = this.#formatFrame(method, file, lineNumber);
        outputLines.push(this.#addLineWithIndentation(1, content));
    }

    /**
     * @param {string} line
     * @param {boolean} isFirst
     * @param {string[]} outputLines
     */
    #processNonStackLine(line, isFirst, outputLines) {
        const content = isFirst
            ? `<strong>${this.#highlightMatches(line)}</strong>`
            : this.#highlightMatches(line);
        outputLines.push(this.#addLineWithIndentation(0, content));
    }

    /**
     * @param {string} method
     * @param {string} file 
     * @param {string} lineNumber
     * @returns {string} HTML formatted string
     */
    #formatFrame(method, file, lineNumber) {
        let content = `at <span class="method">${this.#highlightMatches(method)}</span>`;
        content += this.#formatFileAndLine(file, lineNumber);
        return content;
    }

    /**
     * @param {string} file
     * @param {string} lineNumber
     * @returns {string} HTML formatted file and line details
     */
    #formatFileAndLine(file, lineNumber) {
        if (!file) return "";
        const fileDisplay = this.hideFilePath ? this.#getFileName(file) : file;
        let content = ` <span class="in">in</span> <span class="file">${this.#highlightMatches(fileDisplay)}</span>`;
        if (lineNumber) {
            content += `:<span class="line">line ${this.#highlightMatches(lineNumber)}</span>`;
        }
        return content;
    }

    /**
     * @param {number} indentLevel - The indentation level (e.g., 1, 2, or 3)
     * @param {string} htmlContent
     * @returns {string} HTML formatted line string
     */
    #addLineWithIndentation(indentLevel, htmlContent) {
        return `<div class="stack-line indent-${indentLevel}">${htmlContent}</div>`;
    }
}

# Azure Log Formatter

In Application Insights, double-click a C# exception stack trace or JSON object to view a formatted version.

## TODO

- Double-Click Actions
  - Exception Line: Double-clicking provides a nice summary overview.
  - Trace Line: Double-clicking provides a nice summary overview that includes the message, severity level (and its meaning), and custom dimensions in a JSON view.
  - Row Details: Double-clicking a row (time, problemId, exceptionType, message) displays an overview. (Note: This may not work if results are grouped by problemId, etc.)
  - Results Tab: Double-clicking the "Results" tab shows a list overview of everything. (Note: This may not work if results are grouped by problemId, etc.)

- Testing and Code Quality
  - Add unit tests for stack trace parsing.
  - Refactor the code to be cleaner by:
    - Formatting in a standard/normalized way.
    - Standardizing all checking/"routing".
    - Using a specific modal template based on routing.
    - Implementing a standard outer modal template with different inner - templates (e.g., for JSON and stack traces).
    - Adding code folding.
    - Adding headings and options to the stack traces.
    - Adding line numbering.

- Theming
  - Add both light and dark themes.

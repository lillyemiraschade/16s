// Generate an HTML document that can render React components
export function createReactPreviewHtml(code: string): string {
  // Wrap the code in a self-executing module
  const wrappedCode = `
    (function() {
      const { useState, useEffect, useRef, useCallback, useMemo, Fragment } = React;

      ${code}

      // Find the main component (App, Home, Main, or first exported component)
      const MainComponent = typeof App !== 'undefined' ? App
        : typeof Home !== 'undefined' ? Home
        : typeof Main !== 'undefined' ? Main
        : typeof Page !== 'undefined' ? Page
        : null;

      if (MainComponent) {
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(MainComponent));
      } else {
        document.getElementById('root').innerHTML = '<div style="padding:20px;color:#ef4444;">No component found. Define an App, Home, Main, or Page component.</div>';
      }
    })();
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Preview</title>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js" crossorigin></script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js" crossorigin></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-presets="react">
    ${wrappedCode}
  </script>
</body>
</html>`;
}

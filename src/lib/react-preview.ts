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

// Check if code looks like React/JSX
export function isReactCode(code: string): boolean {
  const reactPatterns = [
    /import\s+.*\s+from\s+['"]react['"]/,
    /function\s+\w+\s*\([^)]*\)\s*{\s*return\s*\(/,
    /const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*\(/,
    /<[A-Z][a-zA-Z]*[\s>]/,
    /useState|useEffect|useRef|useCallback/,
    /className=/,
  ];

  return reactPatterns.some(pattern => pattern.test(code));
}

// Convert simple HTML to React component
export function htmlToReactComponent(html: string): string {
  // Extract body content
  let content = html;
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  if (bodyMatch) {
    content = bodyMatch[1];
  }

  // Extract inline styles from head
  const styleMatch = html.match(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  const styles = styleMatch?.map(s => s.replace(/<\/?style[^>]*>/gi, '')).join('\n') || '';

  // Convert HTML attributes to React-compatible ones
  content = content
    .replace(/class=/g, 'className=')
    .replace(/for=/g, 'htmlFor=')
    .replace(/onclick=/gi, 'onClick=')
    .replace(/onchange=/gi, 'onChange=')
    .replace(/tabindex=/gi, 'tabIndex=')
    .replace(/readonly/gi, 'readOnly')
    .replace(/maxlength=/gi, 'maxLength=')
    .replace(/colspan=/gi, 'colSpan=')
    .replace(/rowspan=/gi, 'rowSpan=');

  // Remove script tags (we'll handle interactivity differently)
  content = content.replace(/<script[\s\S]*?<\/script>/gi, '');

  return `
function App() {
  return (
    <>
      ${styles ? `<style>{\`${styles.replace(/`/g, '\\`')}\`}</style>` : ''}
      ${content}
    </>
  );
}
`;
}

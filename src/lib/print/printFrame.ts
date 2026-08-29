function waitForStylesheets(doc: Document): Promise<void> {
  const links = [...doc.querySelectorAll('link[rel="stylesheet"]')] as Array<HTMLLinkElement>;
  if (links.length === 0) return Promise.resolve();
  return Promise.all(
    links.map(
      (link) =>
        new Promise<void>((resolve) => {
          if (link.sheet) {
            resolve();
            return;
          }
          link.addEventListener("load", () => resolve(), { once: true });
          link.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function waitForImages(doc: Document): Promise<void> {
  const images = [...doc.images];
  if (images.length === 0) return Promise.resolve();
  return Promise.all(
    images.map(
      (image) =>
        new Promise<void>((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

function waitForFonts(doc: Document): Promise<void> {
  if (doc.fonts?.ready) {
    return doc.fonts.ready.then(() => undefined);
  }
  return Promise.resolve();
}

function waitForLayoutFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

/** Wait for external stylesheet, images, fonts, and one layout pass before printing. */
export async function waitForPrintReady(doc: Document): Promise<void> {
  await waitForStylesheets(doc);
  await waitForImages(doc);
  await waitForFonts(doc);
  await waitForLayoutFrame();
}

export async function printHtmlDocument(args: {
  documentTitle: string;
  html: string;
}): Promise<void> {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("title", args.documentTitle);
  iframe.setAttribute("aria-hidden", "true");
  Object.assign(iframe.style, {
    position: "fixed",
    right: "0",
    bottom: "0",
    width: "0",
    height: "0",
    border: "0",
    opacity: "0",
    pointerEvents: "none",
  });
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDocument = iframe.contentDocument ?? frameWindow?.document;
  if (!frameWindow || !frameDocument) {
    iframe.remove();
    throw new Error("Could not open print frame");
  }

  frameDocument.open();
  frameDocument.write(args.html);
  frameDocument.close();

  try {
    await waitForPrintReady(frameDocument);
    const cleanup = () => {
      iframe.remove();
    };
    frameWindow.addEventListener("afterprint", cleanup, { once: true });
    window.setTimeout(cleanup, 60_000);
    frameWindow.focus();
    frameWindow.print();
  } catch (error) {
    iframe.remove();
    throw error;
  }
}

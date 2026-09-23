/**
 * Prism, which React Email's CodeBlock brings into the render module, answers
 * worker messages of its own when it finds itself in a worker: it parses each
 * message as JSON text. The render worker's messages are objects, so once a
 * Visual render had loaded the club's components, every later render in that
 * worker threw. Prism reads this flag when it loads; worker.ts imports this
 * module before anything that can load Prism.
 */
(globalThis as { Prism?: { disableWorkerMessageHandler?: boolean } }).Prism = { disableWorkerMessageHandler: true };

export {};

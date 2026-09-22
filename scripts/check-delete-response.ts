/**
 * Exercises the data provider against the answer SkyMail actually gives a
 * delete: 204 No Content with no body. The property that has to hold is that
 * an archive the server performed is reported to the operator as a success,
 * never as "Silinirken hata oluştu".
 */
import http from "node:http";
import { createSimpleRestDataProvider } from "@refinedev/rest/simple-rest";
import { emptyBodyAsJSON } from "../src/providers/empty-body";

// Every endpoint behind a DeleteButton. All three answer 204 (skymail-backend
// internal/handlers/template.go DeleteTemplate, list.go DeleteList and
// RemoveRecipient), so all three go through the same parse.
const cases = [
  { name: "şablon arşivle", resource: "templates", id: "11111111-1111-1111-1111-111111111111" },
  { name: "liste arşivle", resource: "mailing_lists", id: "22222222-2222-2222-2222-222222222222" },
  {
    name: "alıcı çıkar",
    resource: "mailing_lists/22222222-2222-2222-2222-222222222222/recipients",
    id: "33333333-3333-3333-3333-333333333333",
  },
];

const server = http.createServer((request, response) => {
  if (request.method === "DELETE") {
    response.writeHead(204).end();
    return;
  }
  response.writeHead(404).end();
});

await new Promise<void>((resolve) => server.listen(0, resolve));
const address = server.address();
if (address === null || typeof address === "string") {
  throw new Error("test sunucusu bir porta bağlanamadı");
}

const { dataProvider } = createSimpleRestDataProvider({
  apiURL: `http://127.0.0.1:${address.port}/v1`,
  kyOptions: {
    hooks: {
      afterResponse: [(_request, _options, response) => emptyBodyAsJSON(response)],
    },
  },
});

let failed = 0;
for (const { name, resource, id } of cases) {
  try {
    await dataProvider.deleteOne({ resource, id });
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

server.close();

if (failed > 0) {
  console.error(`\n${failed} durum başarısız.`);
  process.exit(1);
}
console.log(`\n${cases.length} durum geçti.`);

import assert from "node:assert/strict";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handlePinballRulesheetProxyRequest } from "../shared/vite/pinballRulesheetProxy";
import {
  preferredRulesheetLink,
  referenceLinkProvider,
  type LibraryGame,
  type ReferenceLink,
} from "../lpl-library/src/lib/libraryData";

class MemoryResponse {
  statusCode = 200;
  headers = new Map<string, string>();
  body = "";

  setHeader(name: string, value: string | number | readonly string[]) {
    this.headers.set(name.toLowerCase(), String(value));
    return this;
  }

  end(value: string = "") {
    this.body = value;
    return this;
  }
}

const legacyUrl = "https://tiltforums.com/t/game/7210";
const prsLink: ReferenceLink = {
  label: "Rulesheet (Pinball Rule Sheets)",
  url: "https://pinballrulesheets.com/stern/game",
  provider: "pinballrulesheets",
  localPath: null,
  legacyUrls: [legacyUrl],
};
assert.equal(referenceLinkProvider(prsLink), "prs");
assert.equal(preferredRulesheetLink({
  rulesheetLinks: [
    {
      label: "Rulesheet (TF)",
      url: legacyUrl,
      provider: "tf",
      localPath: null,
    },
    prsLink,
  ],
  rulesheetUrl: prsLink.url,
} as LibraryGame), prsLink);

const originalFetch = globalThis.fetch;
globalThis.fetch = async () => new Response(`
  <html><body>
    <nav>Navigation</nav>
    <section class="inner" id="main_content">
      <h1 id="heading--game" onload="bad()">Game</h1>
      <a href="#heading--game">Contents</a>
      <img src="../images/game.png" onerror="bad()">
      <a href="javascript:bad()">Unsafe</a>
      <script>bad()</script>
    </section>
    <footer>Footer</footer>
  </body></html>
`, {
  status: 200,
  headers: { "content-type": "text/html; charset=utf-8" },
});

try {
  const request = {
    method: "GET",
    url: `/pinball/api/rulesheet.php?provider=pinballrulesheets&url=${encodeURIComponent(prsLink.url)}&legacy_url=${encodeURIComponent(legacyUrl)}`,
  } as IncomingMessage;
  const response = new MemoryResponse();
  const handled = await handlePinballRulesheetProxyRequest(
    request,
    response as unknown as ServerResponse,
  );

  assert.equal(handled, true);
  assert.equal(response.statusCode, 200);
  const payload = JSON.parse(response.body) as { provider: string; body: string };
  assert.equal(payload.provider, "prs");
  assert.match(payload.body, /Source: Pinball Rule Sheets/);
  assert.match(payload.body, /Migrated from Tilt Forums\./);
  assert.match(payload.body, /href="#heading--game"/);
  assert.match(payload.body, /src="https:\/\/pinballrulesheets\.com\/images\/game\.png"/);
  assert.doesNotMatch(payload.body, /Navigation|Footer|onload|onerror|javascript:|<script/i);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("Pinball Rule Sheets provider checks passed.");

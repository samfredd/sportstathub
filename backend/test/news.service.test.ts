import assert from 'node:assert/strict';
import test from 'node:test';

import { sanitizeText } from '../src/modules/news/news.service.js';

test('sanitizeText removes encoded HTML tags and attributes from RSS summaries', () => {
  const text = sanitizeText('&lt;p&gt;Arsenal update &lt;a href="https://example.com"&gt;team news&lt;/a&gt; today.&lt;/p&gt;');

  assert.equal(text, 'Arsenal update team news today.');
});

test('sanitizeText decodes common entities without leaving raw markup', () => {
  const text = sanitizeText('<![CDATA[<p>Man City &amp; Liverpool&#39;s latest &quot;talks&quot;</p>]]>');

  assert.equal(text, 'Man City & Liverpool\'s latest "talks"');
});

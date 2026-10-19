import type { Image, ImageReference, Root, Text } from 'mdast';
import remarkFrontmatter from 'remark-frontmatter';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const URL_PATTERN =
  /(?:https?:\/\/|www\.)[^\s<>()]+|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/giu;

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkFrontmatter, ['yaml']);

function stripUrls(text: string): string {
  return text.replace(URL_PATTERN, ' ').replace(/\s+/gu, ' ').trim();
}

export function extractProse(markdown: string): string[] {
  const tree = processor.parse(markdown) as Root;
  const fragments: string[] = [];

  visit(tree, (node) => {
    if (node.type === 'text') {
      fragments.push(stripUrls((node as Text).value));
      return;
    }
    if (node.type === 'image' || node.type === 'imageReference') {
      const alt = (node as Image | ImageReference).alt;
      if (alt) {
        fragments.push(stripUrls(alt));
      }
    }
  });

  return fragments.filter((fragment) => fragment.length > 0);
}

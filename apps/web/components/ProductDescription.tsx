import React from 'react';

interface ProductDescriptionProps {
  description: string | null;
}

type ContentBlock =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'ordered-list'; items: string[] }
  | { type: 'unordered-list'; items: string[] };

const HEADING_PATTERN =
  /^(thông tin sản phẩm|hướng dẫn(?: sử dụng)?|cách sử dụng|hướng dẫn quy đổi|cách quy đổi)/i;
const STEP_PATTERN = /^(?:[-•]\s*)?bước\s*(\d+)\s*[:.)-]\s*(.+)$/i;
const NUMBERED_ITEM_PATTERN = /^(\d+)\s*[.)-]\s*(.+)$/;
const BULLET_PATTERN = /^(?:[-•●▪]|\*)\s+(.+)$/;

function cleanLine(line: string) {
  return line
    .trim()
    .replace(/^\*{2,}\s*/, '')
    .replace(/\s*\*{2,}$/, '')
    .trim();
}

function cleanHeading(line: string) {
  return cleanLine(line).replace(/\s*:+\s*$/, '').trim();
}

function parseDescription(description: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];
  let orderedItems: string[] = [];
  let unorderedItems: string[] = [];
  let previousStepNumber = 0;

  const flushOrderedItems = () => {
    if (orderedItems.length > 0) {
      blocks.push({ type: 'ordered-list', items: orderedItems });
      orderedItems = [];
      previousStepNumber = 0;
    }
  };

  const flushUnorderedItems = () => {
    if (unorderedItems.length > 0) {
      blocks.push({ type: 'unordered-list', items: unorderedItems });
      unorderedItems = [];
    }
  };

  for (const rawLine of description.replace(/\r\n?/g, '\n').split('\n')) {
    const line = cleanLine(rawLine);
    if (!line) {
      flushOrderedItems();
      flushUnorderedItems();
      continue;
    }

    if (HEADING_PATTERN.test(line)) {
      flushOrderedItems();
      flushUnorderedItems();
      const heading = cleanHeading(line);
      if (!/^thông tin sản phẩm$/i.test(heading)) {
        blocks.push({ type: 'heading', text: heading });
      }
      continue;
    }

    const stepMatch = line.match(STEP_PATTERN) || line.match(NUMBERED_ITEM_PATTERN);
    if (stepMatch) {
      flushUnorderedItems();
      const stepNumber = Number(stepMatch[1]);
      if (orderedItems.length > 0 && stepNumber <= previousStepNumber) {
        flushOrderedItems();
      }
      orderedItems.push(stepMatch[2].trim());
      previousStepNumber = stepNumber;
      continue;
    }

    const bulletMatch = line.match(BULLET_PATTERN);
    if (bulletMatch) {
      flushOrderedItems();
      unorderedItems.push(bulletMatch[1].trim());
      continue;
    }

    flushOrderedItems();
    flushUnorderedItems();
    blocks.push({ type: 'paragraph', text: line });
  }

  flushOrderedItems();
  flushUnorderedItems();
  return blocks;
}

export default function ProductDescription({ description }: ProductDescriptionProps) {
  const blocks = description ? parseDescription(description) : [];

  return (
    <section className="space-y-4 border-t border-border pt-5" aria-labelledby="product-description-title">
      <h3
        id="product-description-title"
        className="text-base font-semibold text-slate-800"
      >
        Thông tin sản phẩm
      </h3>

      <div className="max-w-none space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-base leading-relaxed text-slate-700 sm:p-5">
        {blocks.length === 0 ? (
          <p>Chưa có thông tin chi tiết cho sản phẩm này.</p>
        ) : (
          blocks.map((block, index) => {
            if (block.type === 'heading') {
              return (
                <h4
                  key={`${block.type}-${index}`}
                  className="pt-1 text-base font-semibold text-slate-800 first:pt-0"
                >
                  {block.text}
                </h4>
              );
            }

            if (block.type === 'ordered-list') {
              return (
                <ol
                  key={`${block.type}-${index}`}
                  className="list-decimal space-y-2 pl-6 marker:font-semibold marker:text-primary"
                >
                  {block.items.map((item, itemIndex) => (
                    <li key={`${itemIndex}-${item}`} className="pl-1">
                      {item}
                    </li>
                  ))}
                </ol>
              );
            }

            if (block.type === 'unordered-list') {
              return (
                <ul
                  key={`${block.type}-${index}`}
                  className="list-disc space-y-2 pl-6 marker:text-primary"
                >
                  {block.items.map((item, itemIndex) => (
                    <li key={`${itemIndex}-${item}`} className="pl-1">
                      {item}
                    </li>
                  ))}
                </ul>
              );
            }

            return <p key={`${block.type}-${index}`}>{block.text}</p>;
          })
        )}
      </div>
    </section>
  );
}

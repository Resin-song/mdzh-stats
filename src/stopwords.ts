// Curated in-repo list of common multi-character Chinese function words.
// Single-character words are already excluded by the analyzer's length filter.
export const STOPWORDS = new Set<string>([
  '我们', '你们', '他们', '她们', '它们', '自己', '什么', '这样', '那样',
  '这里', '那里', '这个', '那个', '一个', '一些', '可以', '没有', '不是',
  '就是', '已经', '还是', '因为', '所以', '但是', '如果', '然后', '以及',
  '对于', '关于', '时候', '这些', '那些', '这种', '那种', '而且', '或者',
  '虽然', '不过',
]);

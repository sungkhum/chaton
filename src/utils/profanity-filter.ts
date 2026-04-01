import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/** Returns true if the text contains profane or adult content. */
export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}

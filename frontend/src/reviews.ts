export type PublicReview = { rating: number; comment: string | null; createdAt: string };
export type CustomerReview = PublicReview & { requestId: number };

export function averageRating(reviews: PublicReview[]): string {
  return (reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1);
}

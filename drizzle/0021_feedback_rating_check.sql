ALTER TABLE "case_feedback"
  ADD CONSTRAINT "case_feedback_rating_check"
  CHECK ("rating" BETWEEN 1 AND 5);

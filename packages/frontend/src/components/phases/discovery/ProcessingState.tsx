import { ForgeLoader } from "@/components/shared";

const PROCESSING_STEPS = [
  { message: "Reading your context...", detail: "Parsing key information" },
  { message: "Evaluating information density...", detail: "Identifying gaps in coverage" },
  { message: "Mapping technical scope...", detail: "Assessing complexity" },
  { message: "Preparing follow-up questions...", detail: "Finding missing details" },
];

export function ProcessingState() {
  return <ForgeLoader steps={PROCESSING_STEPS} stepInterval={3000} />;
}

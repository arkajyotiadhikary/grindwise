import { Topic } from '../entities/topic.entity';
import { Problem } from '../entities/problem.entity';

export interface PhaseEvaluationResult {
  score: number;
  feedback: string;
  isAcceptable: boolean;
}

export interface PriorPhaseContext {
  phase: string;
  score: number;
  summary: string;
}

export interface TheoryContent {
  coreConcept: string;
  keyTakeaways: string[];
  codeExample?: string;
  analogy?: string;
}

export interface SolutionWalkthrough {
  approach: string;
  steps: string[];
  keyInsight: string;
  timeComplexity: string;
  spaceComplexity: string;
}

export interface RevisionSummary {
  recap: string;
  keyPoints: string[];
  commonMistakes: string[];
  connectsTo: string;
}

export interface DsaAnswerResult {
  isDsaRelated: boolean;
  answer: string;
}

export interface IContentGeneratorPort {
  generateTheory(topic: Topic): Promise<TheoryContent | null>;
  generateSolutionWalkthrough(
    problem: Problem,
    topic: Topic,
  ): Promise<SolutionWalkthrough | null>;
  generateRevisionSummary(
    topic: Topic,
    reviewCount: number,
  ): Promise<RevisionSummary | null>;
  askDsaQuestion(question: string): Promise<DsaAnswerResult | null>;
  formatTheoryMessage(
    topic: Topic,
    content: TheoryContent,
    dayNumber: number,
    weekNumber: number,
  ): string;
  formatSolutionMessage(
    problem: Problem,
    walkthrough: SolutionWalkthrough,
  ): string;
  formatRevisionMessage(
    topic: Topic,
    summary: RevisionSummary,
    daysAgo: number,
  ): string;
  evaluateExplanation(
    userExplanation: string,
    problem: Problem,
    topic: Topic,
    priorPhases?: PriorPhaseContext[],
  ): Promise<PhaseEvaluationResult | null>;
  evaluatePseudoCode(
    userPseudo: string,
    problem: Problem,
    topic: Topic,
    priorPhases?: PriorPhaseContext[],
  ): Promise<PhaseEvaluationResult | null>;
  evaluateCode(
    userCode: string,
    problem: Problem,
    topic: Topic,
    priorPhases?: PriorPhaseContext[],
  ): Promise<PhaseEvaluationResult | null>;
}

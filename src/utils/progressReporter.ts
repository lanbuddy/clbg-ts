const STEP_OFFSET = 1;
const PROGRESS_MAX = 100;
const UPDATE_INTERVAL = 1000;

/**
 * Represents a progress report.
 */
export interface ProgressReport {
  progress: number;
  currentStep: number;
  totalSteps: number;
  currentData: number;
  totalData: number;
  timeRemaining: number;
  currentAction: string;
}

/**
 * Represents a progress reporter.
 */
export class ProgressReporter {
  private totalSteps: number;
  private totalData: number;
  private currentStep: number;
  private currentData: number;
  private currentAction: string;
  private lastUpdated: number;
  private timeRemaining: number;
  private startTime: number;
  private callback?: (progressReport: ProgressReport) => void;

  /**
   * Initializes a new instance of the ProgressReporter class.
   * @param options The options for creating a ProgressReporter instance.
   */
  constructor(options: {
    callback?: (progressReport: ProgressReport) => void;
    totalSteps: number;
  }) {
    this.totalSteps = options.totalSteps;
    this.currentStep = 0;
    this.totalData = 0;
    this.currentData = 0;
    this.currentAction = "";
    this.lastUpdated = 0;
    this.startTime = new Date().getTime();
    this.timeRemaining = Number.MAX_SAFE_INTEGER;
    this.callback = options.callback;
  }

  /**
   * Gets the current progress percentage.
   * @returns The current progress percentage.
   */
  public progress(): number {
    const stepContribution = PROGRESS_MAX / this.totalSteps;
    const basePercentage = (this.currentStep - STEP_OFFSET) * stepContribution;
    const currentStepPercentage =
      (this.currentData / this.totalData) * stepContribution;
    const globalProgress = basePercentage + currentStepPercentage;
    return globalProgress;
  }

  /**
   * Sets the total data to be processed.
   * @param data The total data to be processed.
   */
  public setTotalData(data: number): void {
    this.totalData = data;
    this.currentData = 0;
  }

  /**
   * Updates the current data processed.
   * @param data The data to be processed.
   */
  public updateData(data: number): void {
    this.currentData += data;
    if (this.callback) {
      const currentTime = new Date().getTime();
      if (currentTime - this.lastUpdated < UPDATE_INTERVAL) {
        return;
      }

      this.lastUpdated = currentTime;

      const elapsedTime = currentTime - this.startTime;
      const progress = this.progress();
      const timePerPercent = elapsedTime / progress;
      this.timeRemaining = timePerPercent * (PROGRESS_MAX - progress);

      this.callback({
        currentAction: this.currentAction,
        currentData: this.currentData,
        currentStep: this.currentStep,
        progress: this.progress(),
        timeRemaining: this.timeRemaining,
        totalData: this.totalData,
        totalSteps: this.totalSteps,
      } as ProgressReport);
    }
  }

  /**
   * Advances the current step and resets the current data.
   */
  public advance(actionName: string): void {
    this.currentAction = actionName;
    this.currentStep += STEP_OFFSET;
    this.currentData = 0;
  }

  /**
   * Reports that the progress has been completed.
   */
  public complete(): void {
    this.currentStep = this.totalSteps;
    this.currentData = this.totalData;
    if (this.callback) {
      this.callback({
        currentAction: this.currentAction,
        currentData: this.currentData,
        currentStep: this.currentStep,
        progress: this.progress(),
        timeRemaining: 0,
        totalData: this.totalData,
        totalSteps: this.totalSteps,
      } as ProgressReport);
    }
  }
}

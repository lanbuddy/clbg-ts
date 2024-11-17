import { ProgressReporter } from "../src/utils/progressReporter";

describe("ProgressReporter", () => {
  const callback = jest.fn();

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("should create a new ProgressReporter instance", () => {
    const progressReporter = new ProgressReporter({
      callback,
      totalSteps: 3,
    });
    expect(progressReporter).not.toBeNull();
  });

  test("should calculate the progress percentage correctly", () => {
    const progressReporter = new ProgressReporter({
      callback,
      totalSteps: 1,
    });

    const totalData = 200;
    const updateData = 100;
    const expectedProgress = 50;

    progressReporter?.advance("test");
    progressReporter?.setTotalData(totalData);
    progressReporter?.updateData(updateData);
    const progress = progressReporter?.progress();
    expect(progress).toBe(expectedProgress);
  });

  test("should report a valid progress report", () => {
    const progressReporter = new ProgressReporter({
      callback,
      totalSteps: 1,
    });

    const totalData = 200;
    const updateData = 100;
    const expectedProgress = 50;

    progressReporter?.advance("test");
    progressReporter?.setTotalData(totalData);
    progressReporter?.updateData(updateData);

    const progressReport = {
      currentAction: "test",
      currentData: updateData,
      currentStep: 1,
      progress: expectedProgress,
      timeRemaining: expect.any(Number),
      totalData,
      totalSteps: 1,
    };

    expect(callback).toHaveBeenCalledWith(progressReport);

    progressReporter?.complete();

    const completedProgressReport = {
      currentAction: "test",
      currentData: totalData,
      currentStep: 1,
      progress: 100,
      timeRemaining: expect.any(Number),
      totalData,
      totalSteps: 1,
    };

    expect(callback).toHaveBeenCalledWith(completedProgressReport);
  });
});

const event = require('../event');
const Allure = require('allure-js-commons');

const defaultConfig = {
  outputDir: global.output_dir,
};

/**
 * Allure reporter
 *
 * ![](https://user-images.githubusercontent.com/220264/45676511-8e052800-bb3a-11e8-8cbb-db5f73de2add.png)
 *
 * Enables Allure reporter.
 *
 * ##### Usage
 *
 * To start please install `allure-commandline` package (which requires Java 8)
 *
 * ```
 * npm install -g allure-commandline --save-dev
 * ```
 *
 * Add this plugin to config file:
 *
 * ```js
 * "plugins": {
 *     "allure": {}
 * }
 * ```
 *
 * Run tests with allure plugin enabled:
 *
 * ```
 * codeceptjs run --plugins allure
 * ```
 *
 * By default, allure reports are saved to `output` directory.
 * Launch Allure server and see the report like on a screenshot above:
 *
 * ```
 * allure serve output
 * ```
 *
 * ##### Configuration
 *
 * * `outputDir` - a directory where allure reports should be stored. Standard output directory is set by default.
 *
 *
 */
module.exports = (config) => {
  config = Object.assign(defaultConfig, config);

  const reporter = new Allure();
  reporter.setOptions({ targetDir: config.outputDir });

  let currentMetaStep = [];
  let currentStep;
  let isHookSteps = false;

  this.addAttachment = (name, buffer, type) => {
    reporter.addAttachment(name, buffer, type);
  };

  event.dispatcher.on(event.suite.before, (suite) => {
    reporter.startSuite(suite.fullTitle());
  });

  event.dispatcher.on(event.suite.before, (suite) => {
    for (const test of suite.tests) {
      if (test.pending) {
        reporter.pendingCase(test.title);
      }
    }
  });

  event.dispatcher.on(event.hook.started, (hook) => {
    isHookSteps = true;
  });

  event.dispatcher.on(event.hook.passed, (hook) => {
    isHookSteps = false;
  });

  event.dispatcher.on(event.suite.after, () => {
    reporter.endSuite();
  });

  event.dispatcher.on(event.test.before, (test) => {
    reporter.startCase(test.title);
    currentStep = null;
  });

  event.dispatcher.on(event.test.started, (test) => {
    const currentTest = reporter.getCurrentTest();
    for (const tag of test.tags) {
      currentTest.addLabel('tag', tag);
    }
  });

  event.dispatcher.on(event.test.failed, (test, err) => {
    if (currentStep) reporter.endStep('failed');
    if (currentMetaStep.length) {
      currentMetaStep.forEach(() => reporter.endStep('failed'));
      currentMetaStep = [];
    }
    reporter.endCase('failed', err);
  });

  event.dispatcher.on(event.test.passed, (test) => {
    if (currentStep) reporter.endStep('passed');
    if (currentMetaStep.length) {
      currentMetaStep.forEach(() => reporter.endStep('passed'));
      currentMetaStep = [];
    }
    reporter.endCase('passed');
  });

  event.dispatcher.on(event.step.started, (step) => {
    if (isHookSteps === false) {
      startMetaStep(step.metaStep);
      if (currentStep !== step) {
        // The reason we need to do this cause
        // the step actor contains this and hence
        // the allure reporter could not parse and
        // generate the report
        if (step.actor.includes('\u001b[36m')) {
          step.actor = step.actor.replace('\u001b[36m', '').replace('\u001b[39m', '');
        }
        reporter.startStep(step.toString());
        currentStep = step;
      }
    }
  });

  event.dispatcher.on(event.step.passed, (step) => {
    if (currentStep === step) {
      reporter.endStep('passed');
      currentStep = null;
    }
  });

  event.dispatcher.on(event.step.failed, (step) => {
    if (currentStep === step) {
      reporter.endStep('failed');
      currentStep = null;
    }
  });

  let maxLevel;
  function finishMetastep(level) {
    const metaStepsToFinish = currentMetaStep.splice(maxLevel - level);
    metaStepsToFinish.forEach(() => reporter.endStep('passed'));
  }

  function startMetaStep(metaStep, level = 0) {
    maxLevel = level;
    if (!metaStep) {
      finishMetastep(0);
      maxLevel--;
      return;
    }

    startMetaStep(metaStep.metaStep, level + 1);

    if (metaStep.toString() !== currentMetaStep[maxLevel - level]) {
      finishMetastep(level);
      currentMetaStep.push(metaStep.toString());
      reporter.startStep(metaStep.toString());
    }
  }

  return this;
};

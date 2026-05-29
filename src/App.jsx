import { useEffect, useMemo, useState } from "react";
import { allAirports, airportCategories } from "./data/airports.js";

const CATEGORIES = airportCategories.map(({ category }) => category);
const METHOD_OPTIONS = [
  { id: "choice", label: "객관식" },
  { id: "text", label: "주관식" },
];

const DIRECTION_OPTIONS = [
  {
    id: "code",
    label: "코드",
    promptKey: "name",
    answerKey: "code",
    help: "지역이 주어지면 알맞은 공항 코드를 맞추는 방식입니다.",
  },
  {
    id: "name",
    label: "지역",
    promptKey: "code",
    answerKey: "name",
    help: "공항 코드가 주어지면 알맞은 지역을 맞추는 방식입니다.",
  },
];

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function normalizeCode(value) {
  return value.trim().toUpperCase();
}

function normalizeName(value) {
  return value.trim().replace(/\s+/g, "");
}

function getCategoryItems(selectedCategories) {
  return airportCategories
    .filter(({ category }) => selectedCategories.includes(category))
    .flatMap(({ category, items }) => items.map((item) => ({ ...item, category })));
}

function getCategorySummary(selectedCategories) {
  if (selectedCategories.length === CATEGORIES.length) {
    return `전체 ${allAirports.length}개`;
  }

  return selectedCategories.join(", ");
}

function createChoices(question, answerKey, pool, choiceCount) {
  const correctValue = question[answerKey];
  const wrongValues = pool
    .map((item) => item[answerKey])
    .filter((value) => value !== correctValue);
  const uniqueWrongValues = [...new Set(wrongValues)];

  return shuffle([correctValue, ...shuffle(uniqueWrongValues).slice(0, choiceCount - 1)]);
}

function clampQuestionCount(value, max) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 1;
  }

  return Math.min(Math.max(Math.round(numericValue), 1), Math.max(max, 1));
}

function clampChoiceCount(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return 7;
  }

  return Math.min(Math.max(Math.round(numericValue), 4), 10);
}

function App() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      return savedTheme;
    }

    return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [setupStep, setSetupStep] = useState(1);
  const [selectedCategories, setSelectedCategories] = useState(CATEGORIES);
  const [method, setMethod] = useState("choice");
  const [choiceCount, setChoiceCount] = useState(7);
  const [direction, setDirection] = useState("code");
  const [questionCount, setQuestionCount] = useState(20);
  const [openHelp, setOpenHelp] = useState("");
  const [quiz, setQuiz] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedChoice, setSelectedChoice] = useState("");
  const [typedAnswer, setTypedAnswer] = useState("");
  const [feedback, setFeedback] = useState(null);
  const [wrongAnswers, setWrongAnswers] = useState([]);

  const availableItems = useMemo(() => getCategoryItems(selectedCategories), [selectedCategories]);
  const maxQuestionCount = availableItems.length;
  const selectedDirection = DIRECTION_OPTIONS.find((option) => option.id === direction) ?? DIRECTION_OPTIONS[0];
  const selectedMethod = METHOD_OPTIONS.find((option) => option.id === method) ?? METHOD_OPTIONS[0];
  const currentQuestion = quiz?.questions[currentIndex];
  const isRoundFinished = Boolean(quiz) && currentIndex >= quiz.questions.length;
  const progressCurrent = Math.min(currentIndex + 1, quiz?.questions.length ?? 0);
  const categorySummary = getCategorySummary(selectedCategories);
  const directionStep = method === "choice" ? 4 : 3;
  const countStep = method === "choice" ? 5 : 4;
  const totalSetupSteps = method === "choice" ? 5 : 4;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("theme", theme);
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#10141d" : "#f5f7fb");
  }, [theme]);

  useEffect(() => {
    setQuestionCount((value) => clampQuestionCount(value, maxQuestionCount));
  }, [maxQuestionCount]);

  function resetAnswerState() {
    setSelectedChoice("");
    setTypedAnswer("");
    setFeedback(null);
  }

  function toggleCategory(category) {
    setSelectedCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  function buildRoundQuestions(sourceItems, roundConfig) {
    const pool = roundConfig.pool;

    return shuffle(sourceItems).map((item) => ({
      ...item,
      roundKey: `${item.category}-${item.code}-${Math.random()}`,
      choices: roundConfig.method === "choice"
        ? createChoices(item, roundConfig.answerKey, pool, roundConfig.choiceCount)
        : [],
    }));
  }

  function startQuiz() {
    const limitedItems = shuffle(availableItems).slice(0, questionCount);
    const config = {
      categories: selectedCategories,
      categorySummary,
      method,
      methodLabel: selectedMethod.label,
      choiceCount,
      direction,
      directionLabel: selectedDirection.label,
      promptKey: selectedDirection.promptKey,
      answerKey: selectedDirection.answerKey,
      pool: availableItems,
      initialTotal: limitedItems.length,
      retryRound: 0,
    };

    setQuiz({
      ...config,
      questions: buildRoundQuestions(limitedItems, config),
    });
    setCurrentIndex(0);
    setScore(0);
    setWrongAnswers([]);
    resetAnswerState();
  }

  function startRetryRound() {
    if (!quiz || wrongAnswers.length === 0) {
      return;
    }

    setQuiz({
      ...quiz,
      retryRound: quiz.retryRound + 1,
      questions: buildRoundQuestions(wrongAnswers, quiz),
    });
    setCurrentIndex(0);
    setScore(0);
    setWrongAnswers([]);
    resetAnswerState();
  }

  function exitQuiz() {
    if (!window.confirm("시험을 나가시겠습니까? 현재 진행 중인 결과는 초기화됩니다.")) {
      return;
    }

    setQuiz(null);
    setSetupStep(1);
    setCurrentIndex(0);
    setScore(0);
    setWrongAnswers([]);
    resetAnswerState();
  }

  function restartSetup() {
    setQuiz(null);
    setSetupStep(1);
    setCurrentIndex(0);
    setScore(0);
    setWrongAnswers([]);
    resetAnswerState();
  }

  function checkAnswer(answerValue) {
    if (!currentQuestion || feedback || !quiz) {
      return;
    }

    const correctAnswer = currentQuestion[quiz.answerKey];
    const userAnswer = quiz.answerKey === "code"
      ? normalizeCode(answerValue)
      : normalizeName(answerValue);
    const normalizedCorrect = quiz.answerKey === "code"
      ? normalizeCode(correctAnswer)
      : normalizeName(correctAnswer);
    const correct = userAnswer === normalizedCorrect;

    if (correct) {
      setScore((value) => value + 1);
    } else {
      const { choices, roundKey, ...questionData } = currentQuestion;
      setWrongAnswers((items) => [...items, questionData]);
    }

    setFeedback({ correct, correctAnswer });
  }

  function submitTextAnswer(event) {
    event.preventDefault();
    if (!typedAnswer.trim()) {
      return;
    }
    checkAnswer(typedAnswer);
  }

  function goNext() {
    setCurrentIndex((value) => value + 1);
    resetAnswerState();
  }

  function renderCategoryStep() {
    return (
      <section className="card setup-card">
        <div className="step-header">
          <p className="eyebrow">1 / {totalSetupSteps}</p>
          <h2>카테고리 선택</h2>
        </div>
        <div className="utility-row">
          <button className="secondary-button compact-button" type="button" onClick={() => setSelectedCategories(CATEGORIES)}>
            전체 선택
          </button>
          <button className="secondary-button compact-button" type="button" onClick={() => setSelectedCategories([])}>
            전체 해제
          </button>
        </div>
        <div className="category-grid">
          {CATEGORIES.map((category) => {
            const selected = selectedCategories.includes(category);
            const count = airportCategories.find((group) => group.category === category)?.items.length ?? 0;

            return (
              <button
                className={selected ? "category-card selected" : "category-card"}
                key={category}
                type="button"
                onClick={() => toggleCategory(category)}
                aria-pressed={selected}
              >
                <span className="checkmark">{selected ? "✓" : ""}</span>
                <strong>{category}</strong>
                <span>{count}개</span>
              </button>
            );
          })}
        </div>
        <p className="helper-text">선택한 문제 수: {maxQuestionCount}개</p>
        <button
          className="primary-button"
          disabled={selectedCategories.length === 0}
          type="button"
          onClick={() => setSetupStep(2)}
        >
          다음
        </button>
      </section>
    );
  }

  function renderMethodStep() {
    return (
      <section className="card setup-card">
        <div className="step-header">
          <p className="eyebrow">2 / {totalSetupSteps}</p>
          <h2>퀴즈 방식 선택</h2>
        </div>
        <div className="option-grid">
          {METHOD_OPTIONS.map((option) => (
            <button
              className={method === option.id ? "option-button selected" : "option-button"}
              key={option.id}
              type="button"
              onClick={() => setMethod(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <div className="setup-actions">
          <button className="secondary-button" type="button" onClick={() => setSetupStep(1)}>
            이전
          </button>
          <button className="primary-button" type="button" onClick={() => setSetupStep(3)}>
            다음
          </button>
        </div>
      </section>
    );
  }

  function renderChoiceCountStep() {
    return (
      <section className="card setup-card">
        <div className="step-header">
          <p className="eyebrow">3 / {totalSetupSteps}</p>
          <h2>보기 개수 선택</h2>
        </div>
        <div className="count-control">
          <div className="count-display">{choiceCount}</div>
          <input
            aria-label="보기 개수"
            max="10"
            min="4"
            onChange={(event) => setChoiceCount(clampChoiceCount(event.target.value))}
            type="range"
            value={choiceCount}
          />
          <div className="stepper-row">
            <button className="secondary-button compact-button" type="button" onClick={() => setChoiceCount((value) => clampChoiceCount(value - 1))}>
              -1
            </button>
            <input
              aria-label="보기 개수 직접 입력"
              inputMode="numeric"
              max="10"
              min="4"
              onChange={(event) => setChoiceCount(clampChoiceCount(event.target.value))}
              type="number"
              value={choiceCount}
            />
            <button className="secondary-button compact-button" type="button" onClick={() => setChoiceCount((value) => clampChoiceCount(value + 1))}>
              +1
            </button>
          </div>
        </div>
        <div className="setup-actions">
          <button className="secondary-button" type="button" onClick={() => setSetupStep(2)}>
            이전
          </button>
          <button className="primary-button" type="button" onClick={() => setSetupStep(4)}>
            다음
          </button>
        </div>
      </section>
    );
  }

  function renderDirectionStep() {
    return (
      <section className="card setup-card">
        <div className="step-header">
          <p className="eyebrow">{directionStep} / {totalSetupSteps}</p>
          <h2>문제 방향 선택</h2>
        </div>
        <div className="direction-list">
          {DIRECTION_OPTIONS.map((option) => (
            <div className={direction === option.id ? "direction-card selected" : "direction-card"} key={option.id}>
              <button className="direction-main" type="button" onClick={() => setDirection(option.id)}>
                <span>{option.label}</span>
              </button>
              <button
                className="info-button"
                type="button"
                aria-label={`${option.label} 설명`}
                onClick={() => setOpenHelp((value) => (value === option.id ? "" : option.id))}
              >
                i
              </button>
              {openHelp === option.id && <p className="help-panel">{option.help}</p>}
            </div>
          ))}
        </div>
        <div className="setup-actions">
          <button className="secondary-button" type="button" onClick={() => setSetupStep(method === "choice" ? 3 : 2)}>
            이전
          </button>
          <button className="primary-button" type="button" onClick={() => setSetupStep(countStep)}>
            다음
          </button>
        </div>
      </section>
    );
  }

  function renderQuestionCountStep() {
    return (
      <section className="card setup-card">
        <div className="step-header">
          <p className="eyebrow">{countStep} / {totalSetupSteps}</p>
          <h2>문제 수 선택</h2>
        </div>
        <div className="count-control">
          <div className="count-display">{questionCount}</div>
          <input
            aria-label="문제 수"
            max={maxQuestionCount}
            min="1"
            onChange={(event) => setQuestionCount(clampQuestionCount(event.target.value, maxQuestionCount))}
            type="range"
            value={questionCount}
          />
          <div className="stepper-row">
            <button className="secondary-button compact-button" type="button" onClick={() => setQuestionCount((value) => clampQuestionCount(value - 1, maxQuestionCount))}>
              -1
            </button>
            <input
              aria-label="문제 수 직접 입력"
              inputMode="numeric"
              max={maxQuestionCount}
              min="1"
              onChange={(event) => setQuestionCount(clampQuestionCount(event.target.value, maxQuestionCount))}
              type="number"
              value={questionCount}
            />
            <button className="secondary-button compact-button" type="button" onClick={() => setQuestionCount((value) => clampQuestionCount(value + 1, maxQuestionCount))}>
              +1
            </button>
          </div>
          <button className="secondary-button" type="button" onClick={() => setQuestionCount(maxQuestionCount)}>
            전체 문제
          </button>
          <p className="helper-text">최대 {maxQuestionCount}문제</p>
        </div>
        <div className="setup-actions">
          <button className="secondary-button" type="button" onClick={() => setSetupStep(directionStep)}>
            이전
          </button>
          <button className="primary-button" type="button" onClick={startQuiz}>
            시험 시작
          </button>
        </div>
      </section>
    );
  }

  function renderSetupStep() {
    if (setupStep === 1) {
      return renderCategoryStep();
    }

    if (setupStep === 2) {
      return renderMethodStep();
    }

    if (setupStep === 3 && method === "choice") {
      return renderChoiceCountStep();
    }

    if (setupStep === directionStep) {
      return renderDirectionStep();
    }

    return renderQuestionCountStep();
  }

  return (
    <main className="app-shell">
      <section className="topbar" aria-label="앱 설정">
        <div>
          <p className="eyebrow">Airport Code Quiz</p>
          <h1>공항 코드 퀴즈</h1>
        </div>
        <button
          className="theme-toggle"
          type="button"
          onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))}
          aria-label="테마 전환"
        >
          {theme === "dark" ? "라이트" : "다크"}
        </button>
      </section>

      {!quiz && renderSetupStep()}

      {quiz && !isRoundFinished && currentQuestion && (
        <section className="card quiz-card">
          <div className="quiz-status">
            <span>{progressCurrent} / {quiz.questions.length}</span>
            <span>점수 {score}</span>
          </div>
          <div className="summary-box">
            <span>{quiz.categorySummary}</span>
            <span>
              {quiz.methodLabel} · {quiz.directionLabel}
              {quiz.method === "choice" ? ` · 보기 ${quiz.choiceCount}개` : ""}
            </span>
          </div>

          <div className="prompt-area">
            <p className="mode-label">{quiz.directionLabel} 맞히기</p>
            <div className="prompt-value">{currentQuestion[quiz.promptKey]}</div>
            <p className="prompt-subtext">
              {quiz.answerKey === "code" ? "알맞은 공항 코드를 맞히세요." : "알맞은 지역을 맞히세요."}
            </p>
          </div>

          {quiz.method === "choice" ? (
            <div className="choice-list">
              {currentQuestion.choices.map((choice) => {
                const isSelected = selectedChoice === choice;
                const isCorrectAnswer = feedback && choice === feedback.correctAnswer;
                const isWrongSelected = feedback && isSelected && !feedback.correct;

                return (
                  <button
                    className={[
                      "choice-button",
                      isSelected ? "selected" : "",
                      isCorrectAnswer ? "correct" : "",
                      isWrongSelected ? "wrong" : "",
                    ].filter(Boolean).join(" ")}
                    disabled={Boolean(feedback)}
                    key={choice}
                    type="button"
                    onClick={() => {
                      setSelectedChoice(choice);
                      checkAnswer(choice);
                    }}
                  >
                    {choice}
                  </button>
                );
              })}
            </div>
          ) : (
            <form className="answer-form" onSubmit={submitTextAnswer}>
              <input
                autoCapitalize={quiz.answerKey === "code" ? "characters" : "none"}
                autoComplete="off"
                disabled={Boolean(feedback)}
                inputMode={quiz.answerKey === "code" ? "latin" : "text"}
                onChange={(event) => setTypedAnswer(event.target.value)}
                placeholder={quiz.answerKey === "code" ? "예: LAX" : "예: 로스앤젤레스"}
                value={typedAnswer}
              />
              <button className="primary-button" disabled={!typedAnswer.trim() || Boolean(feedback)} type="submit">
                제출
              </button>
            </form>
          )}

          {feedback && (
            <div className={feedback.correct ? "feedback correct" : "feedback wrong"} role="status">
              <strong>{feedback.correct ? "정답입니다" : "오답입니다"}</strong>
              {!feedback.correct && <span>정답: {feedback.correctAnswer}</span>}
            </div>
          )}

          <div className="quiz-actions">
            <button className="secondary-button" type="button" onClick={exitQuiz}>
              나가기
            </button>
            <button className="primary-button" disabled={!feedback} type="button" onClick={goNext}>
              다음 문제
            </button>
          </div>
        </section>
      )}

      {isRoundFinished && quiz && (
        <section className="card result-card">
          {wrongAnswers.length === 0 ? (
            <>
              <p className="eyebrow">완료</p>
              <h2>모든 문제를 맞혔습니다</h2>
              <p className="result-percent">{quiz.initialTotal}문제 완료</p>
              <p className="result-meta">{quiz.categorySummary} · {quiz.methodLabel} · {quiz.directionLabel}</p>
              <button className="primary-button" type="button" onClick={restartSetup}>
                다시 시작
              </button>
            </>
          ) : (
            <>
              <p className="eyebrow">결과</p>
              <h2>{score} / {quiz.questions.length}</h2>
              <p className="result-percent">{Math.round((score / quiz.questions.length) * 100)}%</p>
              <p className="result-meta">틀린 문제 {wrongAnswers.length}개</p>
              <button className="primary-button" type="button" onClick={startRetryRound}>
                틀린 문제 다시 풀기
              </button>
              <button className="secondary-button result-exit" type="button" onClick={restartSetup}>
                처음으로
              </button>
            </>
          )}
        </section>
      )}
    </main>
  );
}

export default App;

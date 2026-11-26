
(function(global) {

"use strict";

const QuizPlugin = {

    version: "1.2.0",

    config: {},

    questions: [],

    userAnswers: [],

    questionOptions: [],

    questionTypes: [],

    observer: null,

    elements: {},

    root: null,

    eventController: null,

    initialized: false,

    /* =========================================
       INIT
    ========================================= */

    init(options = {}) {

        this.destroy();

        this.config = {
            container: "#quizApp",
            mode: "auto",
            url_media: "",
            data: [],
            showType: false,
            ...options
        };

        this.eventController = new AbortController();

        this.questions = this.normalizeData(this.config.data);

        this.userAnswers = new Array(this.questions.length);

        this.questionOptions = new Array(this.questions.length);

        this.questionTypes = this.getQuestionTypes(
            this.config.mode
        );

        const root = document.querySelector(this.config.container);

        if (!root) {
            console.error("QuizPlugin: Không tìm thấy container.");
            this.eventController.abort();
            this.eventController = null;
            return this;
        }

        this.root = root;

        this.cacheElements();

        this.renderAllQuestions();

        this.createQuestionButtons();

        this.updateStatus();

        this.setupObserver();

        this.bindEvents();

        this.initialized = true;

        return this;
    },

    /* =========================================
       EVENT OPTIONS
    ========================================= */

    get eventOptions() {

        return {
            signal: this.eventController.signal
        };

    },

    /* =========================================
       NORMALIZE DATA
    ========================================= */

    normalizeData(data) {

        if (typeof data === "string") {

            try {
                data = JSON.parse(data);
            } catch (error) {
                console.error("JSON không hợp lệ:", error);
                return [];
            }

        }

        if (!Array.isArray(data)) {
            console.error("Dữ liệu phải là một mảng JSON.");
            return [];
        }

        return data.map(question => ({

            cauhoi: question.cauhoi || "",

            img: question.img || "",

            answer: String(question.answer ?? ""),

            wrong_answers: Array.isArray(question.wrong_answers)
                ? question.wrong_answers.map(String)
                : [],

            text_answer: String(
                question.text_answer ?? question.answer ?? ""
            ),

            solution: question.solution || ""

        }));

    },

    /* =========================================
       QUESTION TYPES
    ========================================= */

    getQuestionTypes(mode) {

        return this.questions.map((question, index) => {

            if (mode === "multi") return "multi";

            if (mode === "text") return "text";

            return index % 2 === 0 ? "multi" : "text";

        });

    },

    /* =========================================
       CACHE ELEMENTS
    ========================================= */

    cacheElements() {

        const get = id => this.root.querySelector("#" + id);

        this.elements = {

            questionsList: get("questionsList"),

            questionGrid: get("questionGrid"),

            answeredCount: get("answeredCount"),

            unansweredCount: get("unansweredCount"),

            correctCount: get("correctCount"),

            wrongCount: get("wrongCount"),

            progressBar: get("quizProgressBar"),

            sidebar: get("quizSidebar"),

            overlay: get("quizOverlay"),

            openButton: get("openQuizMenu"),

            closeButton: get("closeQuizMenu")

        };

    },

    /* =========================================
       NORMALIZE ANSWER
    ========================================= */

    normalizeAnswer(value) {

        return String(value)
            .trim()
            .toLowerCase()
            .replace(/\s+/g, "");

    },

    /* =========================================
       SHUFFLE
    ========================================= */

    shuffleArray(array) {

        const result = [...array];

        for (let i = result.length - 1; i > 0; i--) {

            const j = Math.floor(Math.random() * (i + 1));

            [result[i], result[j]] = [result[j], result[i]];

        }

        return result;

    },

    /* =========================================
       CREATE OPTIONS
    ========================================= */

    createOptions(question, index) {

        if (this.questionOptions[index]) {
            return this.questionOptions[index];
        }

        let options = [
            question.answer,
            ...question.wrong_answers
        ];

        options = [...new Set(
            options.map(value => String(value))
        )].filter(value => value !== "");

        if (options.length < 4) {

            const answer = Number(question.answer);

            if (Number.isFinite(answer)) {

                const candidates = [
                    answer + 1,
                    answer - 1,
                    answer + 2,
                    answer - 2,
                    answer + 3,
                    answer - 3,
                    answer + 10,
                    answer - 10
                ];

                for (const value of this.shuffleArray(candidates)) {

                    const candidate = String(value);

                    if (!options.includes(candidate)) {
                        options.push(candidate);
                    }

                    if (options.length >= 4) break;

                }

            }

        }

        options = this.shuffleArray(options);

        this.questionOptions[index] = options;

        return options;

    },

    /* =========================================
       RENDER ALL QUESTIONS
    ========================================= */

    renderAllQuestions() {

        const container = this.elements.questionsList;

        if (!container) return;

        container.innerHTML = "";

        this.questions.forEach((question, index) => {

            const type = this.questionTypes[index];

            const item = document.createElement("section");

            item.className = "question-item";

            item.id = "question-" + (index + 1);

            /* NUMBER */

            const number = document.createElement("h2");

            number.className = "question-number";

            number.textContent = "Câu " + (index + 1);

            item.appendChild(number);

            /* TYPE */

            if (this.config.showType) {

                const typeLabel = document.createElement("span");

                typeLabel.className = "question-type";

                typeLabel.textContent = type === "multi"
                    ? "TRẮC NGHIỆM"
                    : "NHẬP ĐÁP ÁN";

                item.appendChild(typeLabel);

            }

            /* QUESTION */

            const questionText = document.createElement("div");

            questionText.className = "question-text";

            questionText.innerHTML = question.cauhoi;

            item.appendChild(questionText);

            /* IMAGE */

            if (question.img) {

                const imageBox = document.createElement("div");

                imageBox.className = "question-image";

                const img = document.createElement("img");

                img.src = this.resolveImage(question.img);

                img.alt = "Hình câu " + (index + 1);

                img.loading = "lazy";

                imageBox.appendChild(img);

                item.appendChild(imageBox);

            }

            /* ANSWER */

            if (type === "multi") {

                this.renderMultiQuestion(item, question, index);

            } else {

                this.renderTextQuestion(item, question, index);

            }

            /* SOLUTION */

            const solution = this.createSolution(question);

            item.appendChild(solution);

            if (this.userAnswers[index] !== undefined) {
                solution.classList.add("show");
            }

            container.appendChild(item);

        });

    },

    /* =========================================
       RESOLVE IMAGE
    ========================================= */

    resolveImage(path) {

        path = String(path || "").trim();

        if (!path) return "";

        if (/^(https?:)?\/\//i.test(path) || path.startsWith("data:")) {
            return path;
        }

        const base = String(this.config.url_media || "");

        if (!base) return path;

        return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");

    },

    /* =========================================
       SOLUTION
    ========================================= */

    createSolution(question) {

        const solution = document.createElement("div");

        solution.className = "solution";

        solution.innerHTML =
            "<strong>Lời giải: </strong><br/>" +
            (question.solution || "Chưa có lời giải.");

        return solution;

    },

    /* =========================================
       RENDER MULTI
    ========================================= */

    renderMultiQuestion(item, question, index) {

        const answers = document.createElement("div");

        answers.className = "answers";

        const options = this.createOptions(question, index);

        options.forEach(option => {

            const label = document.createElement("label");

            label.className = "answer";

            const input = document.createElement("input");

            input.type = "radio";

            input.name = "question-" + index;

            input.value = option;

            label.appendChild(input);

            label.appendChild(
                document.createTextNode(option)
            );

            /* RESTORE */

            const oldAnswer = this.userAnswers[index];

            if (oldAnswer !== undefined) {

                input.disabled = true;

                label.classList.add("locked");

                const isRight =
                    this.normalizeAnswer(option) ===
                    this.normalizeAnswer(question.answer);

                const isSelected =
                    this.normalizeAnswer(option) ===
                    this.normalizeAnswer(oldAnswer);

                if (isRight) {
                    label.classList.add("correct");
                }

                if (isSelected) {

                    input.checked = true;

                    if (!isRight) {
                        label.classList.add("wrong");
                    }

                }

            }

            /* CLICK */

            input.addEventListener("change", () => {

                if (this.userAnswers[index] !== undefined) {
                    return;
                }

                this.submitAnswer(index, option);

            }, this.eventOptions);

            answers.appendChild(label);

        });

        if (this.userAnswers[index] !== undefined) {
            item.classList.add("answer-locked");
        }

        item.appendChild(answers);

    },

    /* =========================================
       RENDER TEXT
    ========================================= */

    renderTextQuestion(item, question, index) {

        const box = document.createElement("div");

        box.className = "text-answer-box";

        const input = document.createElement("input");

        input.type = "text";

        input.className = "text-answer-input";

        input.placeholder = "Nhập đáp án...";

        input.autocomplete = "off";

        input.inputMode = "text";

        const button = document.createElement("button");

        button.type = "button";

        button.className = "check-answer-btn";

        button.textContent = "Trả lời";

        box.appendChild(input);

        box.appendChild(button);

        item.appendChild(box);

        /* RESTORE */

        const oldAnswer = this.userAnswers[index];

        if (oldAnswer !== undefined) {

            input.value = oldAnswer;

            input.disabled = true;

            button.disabled = true;

            input.classList.add(
                this.isCorrect(index, oldAnswer) ? "correct" : "wrong"
            );

        }

        /* SUBMIT */

        const submit = () => {

            if (this.userAnswers[index] !== undefined) {
                return;
            }

            const value = input.value.trim();

            if (!value) {
                input.focus();
                return;
            }

            this.submitAnswer(index, value);

        };

        button.addEventListener(
            "click",
            submit,
            this.eventOptions
        );

        input.addEventListener("keydown", event => {

            if (event.key === "Enter") {

                event.preventDefault();

                submit();

            }

        }, this.eventOptions);

    },

    /* =========================================
       CHECK ANSWER
    ========================================= */

    isCorrect(index, value) {

        const question = this.questions[index];

        const type = this.questionTypes[index];

        const correctAnswer = type === "text"
            ? question.text_answer
            : question.answer;

        return this.normalizeAnswer(value) ===
               this.normalizeAnswer(correctAnswer);

    },

    /* =========================================
       SUBMIT ANSWER
    ========================================= */

    submitAnswer(index, value) {

        if (this.userAnswers[index] !== undefined) {
            return false;
        }

        this.userAnswers[index] = String(value);

        const item = this.root.querySelector(
            "#question-" + (index + 1)
        );

        if (!item) return false;

        const correct = this.isCorrect(index, value);

        /* MULTIPLE CHOICE */

        if (this.questionTypes[index] === "multi") {

            // Khóa câu hỏi ngay lập tức
            item.classList.add("answer-locked");

            const labels = item.querySelectorAll(".answer");

            labels.forEach(label => {

                const input = label.querySelector("input");

                input.disabled = true;

                label.classList.add("locked");

                const isRight =
                    this.normalizeAnswer(input.value) ===
                    this.normalizeAnswer(this.questions[index].answer);

                const isSelected =
                    this.normalizeAnswer(input.value) ===
                    this.normalizeAnswer(value);

                label.classList.remove("correct", "wrong");

                // Luôn tô xanh đáp án đúng
                if (isRight) {
                    label.classList.add("correct");
                }

                // Nếu chọn sai, tô đỏ đáp án đã chọn
                if (isSelected && !correct) {
                    label.classList.add("wrong");
                }

            });

        }

        /* TEXT */

        else {

            const input = item.querySelector(".text-answer-input");

            const button = item.querySelector(".check-answer-btn");

            if (input) {

                input.disabled = true;

                input.classList.remove("correct", "wrong");

                input.classList.add(
                    correct ? "correct" : "wrong"
                );

            }

            if (button) {
                button.disabled = true;
            }

        }

        /* SHOW SOLUTION */

        const solution = item.querySelector(".solution");

        if (solution) {
            solution.classList.add("show");
        }

        /* UPDATE */

        this.updateQuestionButtons();

        this.updateStatus();

        return correct;

    },

    /* =========================================
       CREATE QUESTION BUTTONS
    ========================================= */

    createQuestionButtons() {

        const grid = this.elements.questionGrid;

        if (!grid) return;

        grid.innerHTML = "";

        this.questions.forEach((question, index) => {

            const button = document.createElement("button");

            button.type = "button";

            button.className = "question-btn";

            button.textContent = index + 1;

            button.addEventListener("click", () => {

                const target = this.root.querySelector(
                    "#question-" + (index + 1)
                );

                if (!target) return;

                const mobile = window.innerWidth <= 900;

                if (mobile) {
                    this.closeSidebar();
                }

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });

                this.updateCurrentButton(index);

            }, this.eventOptions);

            grid.appendChild(button);

        });

        this.updateQuestionButtons();

    },

    /* =========================================
       UPDATE QUESTION BUTTONS
    ========================================= */

    updateQuestionButtons() {

        if (!this.elements.questionGrid) return;

        const buttons = this.elements.questionGrid.querySelectorAll(
            ".question-btn"
        );

        buttons.forEach((button, index) => {

            button.classList.remove("correct", "wrong");

            const answer = this.userAnswers[index];

            if (answer === undefined) return;

            button.classList.add(
                this.isCorrect(index, answer) ? "correct" : "wrong"
            );

        });

    },

    /* =========================================
       CURRENT BUTTON
    ========================================= */

    updateCurrentButton(index) {

        if (!this.elements.questionGrid) return;

        const buttons = this.elements.questionGrid.querySelectorAll(
            ".question-btn"
        );

        buttons.forEach((button, buttonIndex) => {

            button.classList.toggle(
                "current",
                buttonIndex === index
            );

        });

    },

    /* =========================================
       UPDATE STATUS
    ========================================= */

    updateStatus() {

        if (!this.elements.answeredCount) return;

        let answered = 0;

        let correct = 0;

        let wrong = 0;

        this.userAnswers.forEach((answer, index) => {

            if (answer === undefined) return;

            answered++;

            if (this.isCorrect(index, answer)) {
                correct++;
            } else {
                wrong++;
            }

        });

        const total = this.questions.length;

        this.elements.answeredCount.textContent = answered;

        this.elements.unansweredCount.textContent =
            total - answered;

        this.elements.correctCount.textContent = correct;

        this.elements.wrongCount.textContent = wrong;

        this.elements.progressBar.style.width =
            (total ? answered / total * 100 : 0) + "%";

    },

    /* =========================================
       INTERSECTION OBSERVER
    ========================================= */

    setupObserver() {

        if (!("IntersectionObserver" in window)) return;

        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }

        this.observer = new IntersectionObserver(entries => {

            const visible = entries
                .filter(entry => entry.isIntersecting)
                .sort((a, b) =>
                    b.intersectionRatio - a.intersectionRatio
                );

            if (visible.length) {

                const id = visible[0].target.id;

                const index = parseInt(
                    id.replace("question-", ""),
                    10
                ) - 1;

                this.updateCurrentButton(index);

            }

        }, {
            threshold: [0.2, 0.4, 0.6, 0.8]
        });

        this.root.querySelectorAll(".question-item").forEach(item => {
            this.observer.observe(item);
        });

    },

    /* =========================================
       SIDEBAR
    ========================================= */

    openSidebar() {

        if (!this.elements.sidebar) return;

        this.elements.sidebar.classList.add("open");

        this.elements.overlay.classList.add("show");

        document.body.classList.add("quiz-menu-open");

    },

    closeSidebar() {

        if (!this.elements.sidebar) return;

        this.elements.sidebar.classList.remove("open");

        this.elements.overlay.classList.remove("show");

        document.body.classList.remove("quiz-menu-open");

    },

    /* =========================================
       BIND EVENTS
    ========================================= */

    bindEvents() {

        if (!this.eventController) return;

        const signal = this.eventController.signal;

        if (this.elements.openButton) {

            this.elements.openButton.addEventListener(
                "click",
                () => this.openSidebar(),
                { signal }
            );

        }

        if (this.elements.closeButton) {

            this.elements.closeButton.addEventListener(
                "click",
                () => this.closeSidebar(),
                { signal }
            );

        }

        if (this.elements.overlay) {

            this.elements.overlay.addEventListener(
                "click",
                () => this.closeSidebar(),
                { signal }
            );

        }

        document.addEventListener("keydown", event => {

            if (event.key === "Escape") {
                this.closeSidebar();
            }

        }, { signal });

        window.addEventListener("resize", () => {

            if (window.innerWidth > 900) {
                this.closeSidebar();
            }

        }, { signal });

    },

    /* =========================================
       SET MODE
    ========================================= */

    setMode(mode) {

        if (!["multi", "text", "auto"].includes(mode)) {
            console.error("Mode không hợp lệ.");
            return this;
        }

        this.config.mode = mode;

        this.questionTypes = this.getQuestionTypes(mode);

        this.reset();

        return this;

    },

    /* =========================================
       LOAD DATA
    ========================================= */

    loadData(data) {

        this.questions = this.normalizeData(data);

        this.questionTypes = this.getQuestionTypes(
            this.config.mode
        );

        this.reset();

        return this;

    },

    /* =========================================
       RESET
    ========================================= */

    reset() {

        if (!this.initialized || !this.root) return this;

        this.userAnswers = new Array(this.questions.length);

        this.questionOptions = new Array(this.questions.length);

        this.renderAllQuestions();

        this.createQuestionButtons();

        this.updateStatus();

        this.setupObserver();

        return this;

    },

    /* =========================================
       GET RESULTS
    ========================================= */

    getResults() {

        let correct = 0;

        let wrong = 0;

        this.userAnswers.forEach((answer, index) => {

            if (answer === undefined) return;

            if (this.isCorrect(index, answer)) {
                correct++;
            } else {
                wrong++;
            }

        });

        return {

            total: this.questions.length,

            answered: correct + wrong,

            unanswered: this.questions.length - correct - wrong,

            correct,

            wrong,

            answers: [...this.userAnswers]

        };

    },

    /* =========================================
       DESTROY
    ========================================= */

    destroy() {

        // Hủy tất cả sự kiện đã đăng ký
        if (this.eventController) {

            this.eventController.abort();

            this.eventController = null;

        }

        // Hủy IntersectionObserver
        if (this.observer) {

            this.observer.disconnect();

            this.observer = null;

        }

        // Đóng sidebar
        if (this.elements.sidebar) {
            this.closeSidebar();
        }

        // Xóa nội dung
        if (this.elements.questionsList) {
            this.elements.questionsList.innerHTML = "";
        }

        if (this.elements.questionGrid) {
            this.elements.questionGrid.innerHTML = "";
        }

        this.elements = {};

        this.questions = [];

        this.userAnswers = [];

        this.questionOptions = [];

        this.questionTypes = [];

        this.root = null;

        this.initialized = false;

        return this;

    }

};

global.QuizPlugin = QuizPlugin;

})(window);

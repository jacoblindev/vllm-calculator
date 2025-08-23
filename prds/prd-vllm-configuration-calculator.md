# Product Requirements Document: vLLM Configuration Calculator

## 1. Introduction/Overview

This document outlines the requirements for the **vLLM Configuration Calculator**, a web-based tool designed to help DevOps teams, ML engineers, and developers determine the optimal configuration parameters for deploying models with the vLLM engine.

The core problem this tool solves is the complexity and time involved in finding the right vLLM settings. Users often have to go through a trial-and-error process to balance performance and memory usage. This calculator will provide data-driven recommendations based on the user's specific hardware (GPUs) and the models they intend to serve, simplifying the deployment process and improving resource utilization.

## 2. Goals

* **Simplify Configuration:** To abstract away the complexity of vLLM parameter tuning by providing an intuitive user interface.
* **Provide Tailored Recommendations:** To generate multiple sets of optimized parameters tailored to different performance goals: maximizing throughput, minimizing latency, or achieving a balance.
* **Support Diverse Setups:** To accommodate a wide range of scenarios by allowing users to select from predefined lists of GPUs and models, as well as input their own custom hardware and model specifications.
* **Enable Multi-Model Serving:** To calculate optimal configurations for complex scenarios where multiple different models are served across the same set of GPUs.
* **Educate Users:** To provide clear, concise explanations for each recommended parameter, helping junior developers and those new to vLLM understand the impact of their choices.

## 3. User Stories

* **As an experienced DevOps engineer,** I want to quickly select my GPUs and models and get a ready-to-use command-line string, so I can accelerate my deployment workflow.
* **As a junior developer,** I want to see explanations for each recommended parameter, so I can learn the fundamentals of vLLM configuration and make more informed decisions.
* **As an ML researcher,** I want to input custom GPU (e.g., VRAM) and model (e.g., Hugging Face ID) specifications, so I can experiment with new or non-standard hardware and models.
* **As an ML engineer,** I want to calculate configurations for serving multiple different models on a single GPU cluster, so I can optimize resource allocation and efficiency.

## 4. Functional Requirements

### FR1: GPU Selection

1. The user must be able to select one or more GPU types from a predefined list (e.g., NVIDIA A100, H100, RTX 4090).
2. For each selected GPU type, the user must be able to specify the quantity.
3. The user must have the option to add a "Custom GPU" by manually inputting a name and its VRAM in gigabytes.

### FR2: Model Selection

1. The user must be able to select one or more models from a predefined list of popular models from Hugging Face.
2. The user must have the option to add a "Custom Model" by providing its Hugging Face repository ID. The system should attempt to fetch model details automatically.
3. The system must be able to handle calculations for multiple different models being served across the selected GPUs.

### FR3: Configuration Output

1. After selecting GPUs and models, the system must calculate and display three distinct sets of recommendations for the vLLM parameters, optimized for:
    * Maximum Throughput
    * Minimum Latency
    * Balanced Performance
2. For each recommendation set, the system must display the calculated values for:
    * `--gpu-memory-utilization`
    * `--max-model-len`
    * `--max-num-seqs`
    * `--max-num-batched-tokens`
    * `--block-size`
    * `--swap-space`
3. The system must provide a brief, user-friendly explanation for each recommended parameter value, clarifying its purpose and impact.
4. The system must generate a complete, ready-to-copy `vllm` command-line string for each of the three recommendation sets.

### FR4: User Interface & Experience

1. The application must be a Single Page Application (SPA) for a fluid and responsive user experience.
2. The UI should be intuitive, logically guiding the user from GPU selection, to model selection, and finally to the results.

## 5. Non-Goals (Out of Scope)

* This tool will **not** execute or manage the vLLM deployment itself. It is strictly a calculator.
* This tool will **not** monitor the real-time performance of a running vLLM instance.
* The initial version will **not** support saving or sharing user-defined configurations.
* The calculator will only provide recommendations; it does not guarantee that the underlying models are compatible with vLLM.

## 6. Design Considerations

* **Frontend Framework:** The application will be built using **Vue.js**.
* **UI:** The interface should be clean, modern, and responsive, ensuring usability on standard desktop screen sizes. A clear separation between the "Inputs" (GPU/Model selection) and "Outputs" (Recommendations) sections is crucial.
* **Output Display:** The three recommendation sets (Throughput, Latency, Balanced) should be displayed clearly, perhaps using a tabbed interface or distinct cards to allow for easy comparison.

## 7. Technical Considerations

* **Deployment:** The application will be deployed as a static site to **GitHub Pages**.
* **CI/CD:** A **GitHub Actions** workflow will be set up to automatically build and deploy the Vue.js application to the `gh-pages` branch upon pushes to the `main` branch.
* **Model/GPU Data:** The predefined lists of GPUs and models will be stored in a simple format (e.g., JSON) within the repository. The logic for fetching custom model data from Hugging Face Hub will need to be implemented.
* **Calculation Logic:** The core logic for calculating the parameters will be based on established formulas and heuristics related to vLLM memory management. This may require research and referencing the document `docs/vLLM 參數對 GPU 記憶體使用量的關係與估算.pdf`.

## 8. Success Metrics

* **Adoption:** Number of unique users accessing the tool.
* **User Satisfaction:** Positive feedback and a low number of bug reports or feature requests for core functionality.
* **Goal Completion Rate:** Percentage of users who proceed from inputting data to generating a configuration.

## 9. Open Questions

* What is the definitive source or formula for the calculation logic?
* Which specific GPUs and models should be included in the initial predefined lists?
* How should the calculator handle potential errors, such as an invalid Hugging Face model ID or a configuration that is impossible with the given hardware?

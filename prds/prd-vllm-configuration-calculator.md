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
* **As a DevOps engineer,** I want to see a visual breakdown of the estimated VRAM usage on each GPU, so I can better understand memory allocation and prevent potential OOM errors.
* **As an ML engineer,** I want to calculate configurations for serving multiple different models on a single GPU cluster, so I can optimize resource allocation and efficiency.

## 4. Functional Requirements

### FR1: GPU Selection

1. The user must be able to select one or more GPU types from a predefined list (e.g., NVIDIA A100, H100, RTX 4090).
2. For each selected GPU type, the user must be able to specify the quantity.
3. The user must have the option to add a "Custom GPU" by manually inputting a name and its VRAM in gigabytes.

### FR2: Model Selection

1. The user must be able to select one or more models from a predefined list of popular models from Hugging Face, including different quantization versions (FP16, AWQ 4-bit, GPTQ 4-bit).
2. The system must clearly display quantization information for each model variant, including expected memory reduction factors.
3. When a user wants to add a custom model via its Hugging Face repository ID, the system will:
    a. First, attempt to fetch the model's configuration details (e.g., parameter size, quantization type) from the public, unauthenticated Hugging Face Hub API.
    b. If the API call fails (e.g., due to rate-limiting, a gated/private model, or an invalid ID), the UI must not show an error. Instead, it should seamlessly present a form for the user to enter the required model information manually.
    c. The form for manual entry must include clear, user-friendly instructions and direct links explaining where to find the necessary data on the model's Hugging Face page, including quantization specifications.
4. The system must be able to handle calculations for multiple different models being served across the selected GPUs, whether they are from the predefined list or added manually.
5. The system must factor quantization types and memory reduction factors into all memory calculations.

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

### FR5: VRAM Usage Visualization

1. The system must generate a chart for each GPU or group of identical GPUs.
2. This chart will visually represent the estimated VRAM allocation for each of the three recommendation sets (Throughput, Latency, Balanced).
3. The chart (e.g., a stacked bar chart) must break down the VRAM usage into:
    * Model Weights
    * Maximum KV Cache size
    * Swap Space
    * Reserved/Buffer (to prevent OOM)
4. The visualization should be clearly labeled and displayed alongside the corresponding parameter recommendations.

## 5. Non-Goals (Out of Scope)

* This tool will **not** execute or manage the vLLM deployment itself. It is strictly a calculator.
* This tool will **not** monitor the real-time performance of a running vLLM instance.
* The initial version will **not** support saving or sharing user-defined configurations.
* The calculator will only provide recommendations; it does not guarantee that the underlying models are compatible with vLLM.

## 6. Design Considerations

* **Aesthetic:** The application will have a clean, modern, and developer-focused aesthetic. The design should prioritize clarity, readability, and ease of use. The look and feel should be similar to professional tech sites like Vercel or Stripe, with a spacious layout and a focus on typography.
* **Frontend Framework:** The application will be built using **Vue.js**.
* **Styling:** **Tailwind CSS** will be used for all styling to ensure a consistent and maintainable utility-first CSS workflow.
* **UI:** The interface should be clean, modern, and responsive, ensuring usability on standard desktop screen sizes. A clear separation between the "Inputs" (GPU/Model selection) and "Outputs" (Recommendations) sections is crucial.
* **Output Display:** The three recommendation sets (Throughput, Latency, Balanced) should be displayed clearly, perhaps using a tabbed interface or distinct cards to allow for easy comparison.
* **Data Visualization:** VRAM usage will be visualized using charts created with the **Chart.js** library. The charts should be easy to read and clearly labeled.

## 7. Technical Considerations

* **Deployment:** The application will be deployed as a static site to **GitHub Pages**.
* **CI/CD:** A **GitHub Actions** workflow will be set up to automatically build and deploy the Vue.js application to the `gh-pages` branch upon pushes to the `main` branch.
* **Frontend Dependencies:** The project will use **Vue.js**, **Tailwind CSS**, and **Chart.js**.
* **Model/GPU Data:** The predefined lists of GPUs and models will be stored in a simple format (e.g., JSON) within the repository.
* **Hugging Face Integration:** All interactions with the Hugging Face Hub will be done client-side via its public, unauthenticated API endpoints. To handle potential rate-limiting or access issues with private/gated models, the application will implement a fallback mechanism that allows users to input model details manually. No API keys will be stored in the application.
* **Calculation Logic:** The core logic for calculating the parameters will be based on established formulas and heuristics related to vLLM memory management. This may require research and referencing the document `docs/vLLM 參數對 GPU 記憶體使用量的關係與估算.pdf`.

## 8. Success Metrics

* **Adoption:** Number of unique users accessing the tool.
* **User Satisfaction:** Positive feedback and a low number of bug reports or feature requests for core functionality.
* **Goal Completion Rate:** Percentage of users who proceed from inputting data to generating a configuration.

## 9. Open Questions

* What is the definitive source or formula for the calculation logic?
* Which specific GPUs and models should be included in the initial predefined lists?
* How should the UI clearly guide users through the manual model-info submission process when an API call fails?

## 10. Future Enhancements

* **AMD GPU Support:** Extend the calculator to support AMD GPUs (e.g., Instinct MI300X, MI250) by incorporating ROCm-specific considerations into the calculation logic and predefined hardware list. This will depend on the stability and performance of vLLM's ROCm support.
* **Save/Share Configurations:** Allow users to save their hardware and model setups or share a unique URL to their specific configuration results.

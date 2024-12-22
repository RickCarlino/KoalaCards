# KoalaCards Setup Guide

This guide will help you set up the project on your local machine. Please follow the instructions carefully to ensure a smooth setup experience.

> **Note:** This project is currently in a semi-public alpha phase. If you encounter any issues or have questions, feel free to [raise an issue](https://github.com/RickCarlino/KoalaCards/issues) on GitHub.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
   - [1.1 Install Node.js](#11-install-nodejs)
   - [1.2 Install Docker](#12-install-docker)
   - [1.3 Install Docker Compose](#13-install-docker-compose)
   - [1.4 (Optional) Install TailScale](#14-optional-install-tailscale)
2. [Clone the Repository](#clone-the-repository)
3. [Set Up Environment Variables](#set-up-environment-variables)
4. [Configure Cloud Services](#configure-cloud-services)
   - [4.1 OpenAI API Key](#41-openai-api-key)
   - [4.2 Google Cloud Service Account](#42-google-cloud-service-account)
5. [Run the Application](#run-the-application)
6. [Accessing the Application](#accessing-the-application)
7. [Troubleshooting](#troubleshooting)
8. [Additional Resources](#additional-resources)

---

## Prerequisites

Before setting up **KoalaCards**, ensure that your system meets the following prerequisites.

### 1.1 Install Node.js

**KoalaCards** requires Node.js to run. It's recommended to use the latest **Long-Term Support (LTS)** version.

1. **Download Node.js:**

   Visit the [official Node.js website](https://nodejs.org/) and download the installer for your operating system.

2. **Install Node.js:**

   Run the downloaded installer and follow the on-screen instructions.

3. **Verify Installation:**

   Open your terminal or command prompt and run:

   ```bash
   node -v
   npm -v
   ```

   You should see the installed versions of Node.js and npm.

   ```bash
   v22.x.x
   10.x.x
   ```

   > **Note:** **KoalaCards** has been tested with Node.js v22. It's recommended to use this version to avoid compatibility issues.

### 1.2 Install Docker

Docker is essential for containerizing the application and its dependencies.

1. **Download Docker:**

   Visit the [official Docker website](https://www.docker.com/get-started) and download Docker Desktop for your operating system.

2. **Install Docker:**

   Run the downloaded installer and follow the installation prompts.

3. **Verify Installation:**

   Open your terminal or command prompt and run:

   ```bash
   docker --version
   ```

   You should see the installed Docker version.

   ```bash
   Docker version 24.x.x, build xxxxxxx
   ```

### 1.3 Install Docker Compose

Docker Compose is used to manage multi-container Docker applications.

1. **Check if Docker Compose is Installed:**

   Docker Desktop typically includes Docker Compose. Verify by running:

   ```bash
   docker-compose --version
   ```

   You should see the installed Docker Compose version.

   ```bash
   docker-compose version 2.x.x, build xxxxxxx
   ```

2. **If Not Installed, Install Docker Compose:**

   Follow the [official Docker Compose installation guide](https://docs.docker.com/compose/install/) for your operating system.

### 1.4 (Optional) Install TailScale

**TailScale** is used for secure networking and is required for **magic link sign-in** functionality in **KoalaCards**.

> **Note:** If you intend to use the magic link sign-in feature, installing TailScale is **mandatory**. Otherwise, it's optional.

1. **Download TailScale:**

   Visit the [official TailScale website](https://tailscale.com/download/) and download the appropriate installer for your operating system.

2. **Install TailScale:**

   Run the downloaded installer and follow the installation prompts.

3. **Authenticate TailScale:**

   After installation, launch TailScale and follow the on-screen instructions to authenticate and connect to your TailScale network.

---

## Clone the Repository

To get started, clone the **KoalaCards** repository from GitHub.

1. **Open Terminal or Command Prompt:**

2. **Clone the Repository:**

   ```bash
   git clone git@github.com:RickCarlino/KoalaCards.git
   ```

   > **Note:** Ensure you have SSH access to GitHub. If you prefer HTTPS, use:

   ```bash
   git clone https://github.com/RickCarlino/KoalaCards.git
   ```

3. **Navigate to the Project Directory:**

   ```bash
   cd KoalaCards
   ```

---

## Set Up Environment Variables

Environment variables are crucial for configuring the application. Follow these steps to set them up.

1. **Copy the Example Environment File:**

   ```bash
   cp example.env .env
   ```

2. **Open the `.env` File:**

   Use your preferred text editor to open the `.env` file.

   ```bash
   nano .env
   ```

   Replace `nano` with your editor of choice (e.g., `vim`, `code` for VS Code).

3. **Fill Out the Required Environment Variables:**

   Update the `.env` file with your specific configurations. Below are the key variables you need to set:

   ```env
   # Database Configuration
   POSTGRES_USER=prisma
   POSTGRES_PASSWORD=your_password
   POSTGRES_DB=prisma_dev
   POSTGRES_URI=postgres://prisma:your_password@db:5432/prisma_dev

   # OpenAI Configuration
   OPENAI_API_KEY=your_openai_api_key

   # Google Cloud Configuration
   GOOGLE_APPLICATION_CREDENTIALS=./path-to-your-gcs-credentials.json
   ```

   > **Security Tip:** Never commit your `.env` file to version control. Ensure it's listed in your `.gitignore`.

4. **Save and Close the `.env` File:**

   If using `nano`, press `CTRL + O` to save and `CTRL + X` to exit.

---

## Configure Cloud Services

**KoalaCards** integrates with external cloud services like OpenAI and Google Cloud. Follow the steps below to configure these services.

### 4.1 OpenAI API Key

1. **Create an OpenAI Account:**

   If you don't have one, sign up at [OpenAI](https://platform.openai.com/signup).

2. **Generate an API Key:**

   - Navigate to the [API Keys](https://platform.openai.com/account/api-keys) section in your OpenAI dashboard.
   - Click on **"Create new secret key"**.
   - Copy the generated API key.

3. **Update the `.env` File:**

   Open the `.env` file and set the `OPENAI_API_KEY`:

   ```env
   OPENAI_API_KEY=sk-your-openai-api-key
   ```

   > **Security Tip:** Keep your API keys secure and avoid sharing them publicly.

### 4.2 Google Cloud Service Account

1. **Create a Google Cloud Account:**

   If you don't have one, sign up at [Google Cloud](https://cloud.google.com/).

2. **Create a New Project:**

   - Navigate to the [Google Cloud Console](https://console.cloud.google.com/).
   - Click on **"Select a project"** and then **"New Project"**.
   - Enter a project name and click **"Create"**.

3. **Enable Required APIs:**

   - Go to **APIs & Services > Library** in the Google Cloud Console.
   - Search for and enable the following APIs:
     - **Cloud Speech-to-Text API**
     - **Cloud Text-to-Speech API**

4. **Create a Service Account:**

   - Navigate to **APIs & Services > Credentials**.
   - Click on **"Create Credentials"** and select **"Service Account"**.
   - Enter a name and description for the service account.
   - Assign the necessary roles (e.g., **"Cloud Speech Client"**, **"Cloud Text-to-Speech Client"**).
   - Click **"Done"**.

5. **Generate a JSON Key for the Service Account:**

   - In the **Service Accounts** list, find your newly created service account.
   - Click on the **three dots** under **Actions** and select **"Manage Keys"**.
   - Click **"Add Key"** > **"Create new key"** > **"JSON"** > **"Create"**.
   - A JSON file will be downloaded to your machine. **Keep this file secure**.

6. **Update the `.env` File:**

   Place the downloaded JSON credentials file in the project directory (e.g., `./credentials/gcs.json`) and update the `.env` file:

   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./credentials/gcs.json
   ```

   > **Security Tip:** Do not commit your credentials file to version control. Ensure it's listed in your `.gitignore`.

---

## Run the Application

With all configurations in place, you can now run **KoalaCards** using Docker Compose.

1. **Ensure Docker is Running:**

   Make sure Docker Desktop is up and running on your machine.

2. **Build and Start the Services:**

   From the project root directory, run:

   ```bash
   docker-compose up -d --build
   ```

   - `-d`: Runs the containers in detached mode (in the background).
   - `--build`: Rebuilds the images if there are any changes in the `Dockerfile` or dependencies.

3. **Verify the Services are Running:**

   ```bash
   docker-compose ps
   ```

   You should see both `app` and `db` services running.

4. **Apply Database Migrations:**

   The `entrypoint.sh` script automatically handles migrations when the `app` container starts. To manually run migrations, you can execute:

   ```bash
   docker-compose exec app npx prisma migrate deploy
   ```

5. **Access Prisma Studio (Optional):**

   Prisma Studio provides a visual interface to interact with your database.

   ```bash
   docker-compose exec app npx prisma studio
   ```

   Open the provided URL in your browser to access Prisma Studio.

---

## Accessing the Application

Once the application is running, you can access it via your web browser.

1. **Open Your Browser:**

2. **Navigate to:**

   ```
   http://localhost:3000
   ```

---

## Troubleshooting

If you encounter any issues during setup or while running the application, consider the following steps:

1. **Check Container Logs:**

   View logs for all services:

   ```bash
   docker-compose logs -f
   ```

   To view logs for a specific service (e.g., `app`):

   ```bash
   docker-compose logs -f app
   ```

2. **Restart Services:**

   Sometimes, restarting the services can resolve transient issues.

   ```bash
   docker-compose restart
   ```

3. **Rebuild Containers:**

   If you've made changes to the `Dockerfile` or dependencies, rebuild the containers.

   ```bash
   docker-compose up -d --build
   ```

4. **Verify Environment Variables:**

   Ensure that all required environment variables in the `.env` file are correctly set and that sensitive information like API keys and credentials are accurate.

5. **Check Docker Resources:**

   Ensure that Docker has sufficient resources (CPU, memory) allocated. You can adjust these settings in Docker Desktop under **Settings > Resources**.

6. **Ensure Network Connectivity:**

   If using TailScale, verify that it's properly installed and connected. This is essential for the magic link sign-in feature.

7. **Reset Migrations (Development Only):**

   If migrations are out of sync, you can reset them. **Warning:** This will delete all data in the database.

   ```bash
   docker-compose exec app npx prisma migrate reset
   ```

8. **Seek Help:**

   If problems persist, [raise an issue](https://github.com/RickCarlino/KoalaCards/issues) on GitHub with detailed information about the issue.

---

## Additional Resources

- **Docker Documentation:** [https://docs.docker.com/](https://docs.docker.com/)
- **Prisma Documentation:** [https://www.prisma.io/docs/](https://www.prisma.io/docs/)
- **OpenAI API Reference:** [https://platform.openai.com/docs/api-reference](https://platform.openai.com/docs/api-reference)
- **Google Cloud Speech-to-Text:** [https://cloud.google.com/speech-to-text/docs](https://cloud.google.com/speech-to-text/docs)
- **Google Cloud Text-to-Speech:** [https://cloud.google.com/text-to-speech/docs](https://cloud.google.com/text-to-speech/docs)
- **TailScale Documentation:** [https://tailscale.com/kb/](https://tailscale.com/kb/)

---

> **These instructions may be out of date. Please [raise an issue](https://github.com/RickCarlino/KoalaCards/issues) if things don't work!**

# NodeForge ⚡

**Stop writing boilerplate. Start building products.**

NodeForge is the ultimate productivity companion for backend developers. It transforms hours of repetitive setup into seconds of automated generation. Whether you are bootstrapping a fresh project or scaling an existing one, NodeForge builds high-quality, professional-grade Node.js/Express layers tailored to your specific architecture.

With a powerful **Interactive Sidebar**, NodeForge puts the power of complex scaffolding directly at your fingertips. Choose your language, your database, and your architectural patterns with a single click.

---

### 🚀 Core Features

*   **Full Managed Scaffolding**: Generate an entire production-ready backend in seconds.
*   **Multi-Database Support**: Seamless integration for **MongoDB (Mongoose)**, **MySQL (mysql2)**, and **Postgres (pg)**.
*   **Bilingual Base**: Native support for both **JavaScript** and **TypeScript** (including automatic type definition installs).
*   **JWT Authentication**: One-click generation of Secure Auth modules (User Model, Controllers, Middleware, and Route protection).
*   **Smart "Add Module" Logic**: Already have a project? NodeForge **auto-detects** your existing language, database, and folder structure to inject new CRUD modules and update your `server.ts` or `server.js` automatically.
*   **Custom Environments**: Configure Ports, Connection Strings, and 3 different Folder Architecture layouts.

---

### 🎨 Visual Guide & Interactive Sidebar

> **Recommended Asset:** *Place a GIF here showing you filling out the form and clicking "Generate". Seeing the folders pop into existence in the sidebar is the most "impressive" visual.*

#### 1. Module Section (New Projects)
Perfect for starting a specific entity from scratch. This section allows you to define the DNA of your new project.

![image alt](https://github.com/WeerasingheMSC/First_Exetention/blob/f8d16ce281346052c623417e40903b649b2bd2da/Screenshot%202026-03-21%20at%2013.14.07.png)

*   **Module Name**: Name your entity (e.g., `Product`, `Order`).
*   **Fields**: Define your schema in a simple string (`name:string, price:number`).
*   **Language**: Select between `JavaScript` or `TypeScript`.
*   **Connection URI**: Input your DB string (e.g., `mongodb://localhost:27017/mydb`).
*   **Port**: Define your server's resting port.
*   **Folder Structure**: Choose how your code is organized:
    *   **Simple**: Flat structure for small APIs.
    *   **Advanced**: Clean `src/` layout with separated concerns.
    *   **Clean Architecture**: Enterprise-ready separation of Presentation, Domain, and Data.

#### 2. Auth Section (Secure your App)
Easily add a security layer to any existing project.

*   **Language Selection**: Just pick your project's language, and NodeForge will write the `bcrypt` and `jsonwebtoken` logic for you, including specialized middleware and .env configuration.

#### 3. Full Backend Section (The Powerhouse)
Need a complete API with security out of the box? This generates the "Gold Standard" advanced backend.

*   **Module Name & Fields**: Set up your primary entity.
*   **Database Choice**: Pick your engine.
*   **Result**: Generates the Module + User Auth + JWT protection + Server Auto-configuration in an **Advanced (/src)** layout.

#### 4. Add Section (The Scalability Tool)
The smartest feature in NodeForge. It reads your current workspace to understand how you code.

*   **Auto-Detection**: It figures out if you are using TypeScript or JS, which database driver is installed, and where your folders are.
*   **Zero-Config Update**: It generates the files and **patches your server file** so the new routes are immediately live.

---

### ⚒️ How to Use
1.  Open the **NodeForge** icon in the Activity Bar.
2.  Choose your generation mode (Module, Auth, Full, or Add).
3.  Fill in your details and hit **Generate**.
4.  Run `npm install` and `npm run dev` in the terminal that pops up!

---

### 🙌 Thank You!
Thank you for choosing **NodeForge** to power your development workflow. We built this to save you from the "boring stuff" so you can focus on building the features that matter. 

If you find this extension helpful, please consider leaving a review on the Marketplace!

**Happy Coding!** 🚀

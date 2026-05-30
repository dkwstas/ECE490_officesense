import AdminJS from "adminjs";
import AdminJSExpress from "@adminjs/express";
import * as AdminJSPrisma from "@adminjs/prisma";
import session from "express-session";
import { componentLoader, Components } from './components.js'

import userResource from "./resources/adminjs.user.resource.js";
import tagResource from "./resources/adminjs.tag.resource.js";
import roomResource from "./resources/adminjs.room.resource.js";

AdminJS.registerAdapter({
  Database: AdminJSPrisma.Database,
  Resource: AdminJSPrisma.Resource,
})

async function createAdmin() {
  const admin = new AdminJS({
    rootPath: "/admin",
    resources: [userResource, tagResource, roomResource],
    branding: { companyName: "OfficeSense", logo: false },
    dashboard: { component: Components.Dashboard },
    componentLoader,
  });

  await admin.watch();

  const router = AdminJSExpress.buildAuthenticatedRouter(
    admin,
    {
      authenticate: async (email, password) => {
        if (
          email === process.env.ADMIN_EMAIL &&
          password === process.env.ADMIN_PASSWORD
        ) {
          return { email }
        }
        return null
      },
      cookieName: 'adminjs',
      cookiePassword: process.env.ADMIN_COOKIE_SECRET ?? 'change-me',
    },
    null,
    {
      resave: false,
      saveUninitialized: false,
      secret: process.env.ADMIN_COOKIE_SECRET ?? 'change-me',
    }
  )

  return { admin, router }
}

const sessionMiddleware = session({
  secret: process.env.ADMIN_COOKIE_SECRET ?? "change-me",
  resave: false,
  saveUninitialized: false,
});

export { createAdmin, sessionMiddleware }
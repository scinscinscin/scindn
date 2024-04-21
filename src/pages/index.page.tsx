import Link from "next/link";
import { PrivateLayout } from "../layouts/private";
import styles from "./index.module.scss";
import { Button } from "./components/Button";
import { Project } from "@prisma/client";
import { db } from "../utils/prisma";

const Page = PrivateLayout.createPage<{ projects: { uuid: string; name: string }[] }>({
  page({ projects }) {
    return {
      seo: { title: "Projects" },
      children: (
        <div>
          <header className={styles.header}>
            <h2>Projects</h2>
            <Button.Link href="/project/create">New Project</Button.Link>
          </header>

          {/* <p>No projects found.</p> */}

          <ul className={styles.projects}>
            {projects.map((proj) => (
              <li key={proj.uuid}>
                <Link href={`/project/${proj.uuid}`}>{proj.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      ),
    };
  },
  async getServerSideProps(ctx, { user }) {
    const projects = await db.project.findMany({ where: { ownerUuid: user.uuid } });
    return { props: { projects: projects.map((proj) => ({ name: proj.name, uuid: proj.uuid })) } };
  },
});

export default Page.defaultExport;
export const getServerSideProps = Page.getServerSideProps;

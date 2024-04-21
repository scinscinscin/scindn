import { GenerateLayout, GenerateLayoutOptionsImpl } from "@scinorandex/layout";
import { NextSeo, NextSeoProps } from "next-seo";
import styles from "./layout.module.scss";
import Link from "next/link";
import { User } from "@prisma/client";

interface PublicLayoutOptions extends GenerateLayoutOptionsImpl {
  // the page can return NextSeoProps to define the SEO meta tags of the page
  ClientSideLayoutProps: { seo?: NextSeoProps };
  // the layout needs the username of the currently logged in user
  ServerSideLayoutProps: { username: string };
  ServerSidePropsContext: { user: User };
}

export const PrivateLayout = GenerateLayout<PublicLayoutOptions>({
  /**
   * Create a layout that prints the currently logged in user
   */
  layoutComponent({ internalProps, layoutProps }) {
    return (
      <>
        <NextSeo
          {...{
            title: "@scinorandex/ssr Layout Example",
            description: "A page made with @scinorandex/ssr",
            titleTemplate: "%s | ScinDN",
            ...layoutProps.seo,
          }}
        />

        <div className={styles.root}>
          <header className={styles.header}>
            <h2 style={{ color: "var(--white)" }}>ScinDN</h2>

            <Link href="/">Projects</Link>
            <Link href="/account">Account</Link>
          </header>

          <main className={styles.main}>{layoutProps.children}</main>
        </div>
      </>
    );
  },

  /**
   * Fetch the created users from the database and return to the layout component
   */
  async getServerSideProps(ctx) {
    const user = ctx.res.locals.user;
    if (user == null) return { redirect: { permanent: false, destination: "/login" } };

    return {
      props: { layout: { username: user.username }, locals: { user } },
    };
  },
});

import Link from "next/link";
import React from "react";
import styles from "./Button.module.scss";

export const Button = {
  Solid: (props: {
    disabled?: boolean;
    className?: string;
    onClick: "submit" | "reset" | (() => void);
    children: React.ReactNode;
  }) => {
    return (
      <button
        className={styles.button + " " + props.className}
        onClick={typeof props.onClick === "function" ? props.onClick : undefined}
        type={typeof props.onClick === "function" ? "button" : props.onClick}
        disabled={props.disabled}
      >
        {props.children}
      </button>
    );
  },

  Link: (props: { href: string; children: React.ReactNode }) => {
    return (
      <Link href={props.href} className={styles.button + " " + styles.link}>
        {props.children}
      </Link>
    );
  },
};

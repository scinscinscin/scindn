import { useForm } from "react-hook-form";
import { PrivateLayout } from "../../layouts/private";
import styles from "./create.module.scss";
import { Button } from "../components/Button";
import { useState } from "react";
import { toast } from "react-toastify";
import { client } from "../../utils/apiClient";
import Modal from "react-modal";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClipboard } from "@fortawesome/free-regular-svg-icons";
import { useRouter } from "next/router";

const modalStyles = {
  overlay: {
    backgroundColor: `#000000dd`,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    position: "unset",
    backgroundColor: "var(--background)",
    color: `var(--white)`,
    minWidth: `500px`,
    borderRadius: "5px",
    border: "2px solid var(--muted)",
    width: "min-content",
    height: "fit-content",
  },
} as const;

async function submit(origins: string[], name: string) {
  const verifiedOrigins = origins
    .filter((e) => e.length > 0)
    .map((origin) => {
      try {
        return new URL(origin).origin;
      } catch {
        return { error: true, origin };
      }
    });

  const malformed = verifiedOrigins.filter((o) => typeof o !== "string") as { error: true; origin: string }[];

  if (malformed.length > 0) {
    toast.error(`Malformed origins: ${malformed.map((m) => `"${m.origin}"`).join(", ")}`);
    throw null;
  } else if (verifiedOrigins.length == 0) {
    toast.error("At least one JS origin is required");
    throw null;
  }

  const payload = { name, origins: verifiedOrigins as string[] };
  const result = await client["/project"]["/create"].post({ body: payload });
  return result;
}

export const Page = PrivateLayout.createPage<{}>({
  page() {
    const Form = useForm<{ name: string }>();
    const [origins, setOrigins] = useState<string[]>([""]);
    const [submitting, setIsSubmitting] = useState(false);
    const [modalData, setModalData] = useState<{ clientId: string; secret: string; name: string } | null>(null);
    const router = useRouter();

    return {
      seo: { title: "Create Project" },
      children: (
        <>
          <div>
            <header>
              <h2>Create Project</h2>
            </header>

            <form
              className={"form " + styles.form}
              onSubmit={Form.handleSubmit(({ name }) => {
                setIsSubmitting(true);
                submit(origins, name)
                  .then((result) => {
                    console.log(result);
                    setModalData(result);
                  })
                  .finally(() => setIsSubmitting(false));
              })}
            >
              <div className="field">
                <label htmlFor="name">Name</label>
                <input {...Form.register("name")} required placeholder="Name" />
              </div>

              <div className="field">
                <label htmlFor="jsOrigins">JavaScript Origins</label>

                <div className={styles.origins}>
                  {origins.map((origin, idx) => (
                    <input
                      placeholder="HTTP Origin"
                      value={origin}
                      onChange={(event) => {
                        setOrigins(origins.map((o, i) => (idx !== i ? o : event.target.value)));
                        if (idx == origins.length - 1) setOrigins((e) => [...e, ""]);
                        if (event.target.value.length == 0) {
                          if (origins.length != 1) setOrigins((origins) => origins.filter((_, i) => i !== idx));
                        }
                      }}
                    />
                  ))}
                </div>
              </div>

              <Button.Solid onClick="submit" className={styles.submit} disabled={submitting}>
                Create new project
              </Button.Solid>
            </form>
          </div>

          <Modal style={modalStyles} isOpen={modalData !== null}>
            {modalData && (
              <>
                <h3>Credentials for "{modalData.name}"</h3>

                <form className={"form " + styles.modalForm}>
                  <div className="field">
                    <label htmlFor="id">Client ID</label>
                    <div className={styles.divider}>
                      <input type="text" disabled value={modalData.clientId} />
                      <FontAwesomeIcon
                        icon={faClipboard}
                        onClick={() => {
                          window.navigator.clipboard.writeText(modalData.clientId);
                          toast.success("Copied Client ID to clipboard", { autoClose: 3000 });
                        }}
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="secret">Secret</label>
                    <div className={styles.divider}>
                      <input type="text" disabled value={modalData.secret} />
                      <FontAwesomeIcon
                        icon={faClipboard}
                        onClick={() => {
                          window.navigator.clipboard.writeText(modalData.secret);
                          toast.success("Copied secret to clipboard", { autoClose: 3000 });
                        }}
                      />
                    </div>
                  </div>

                  <p>Make sure to copy these values as once you close this modal, you cannot see them again</p>

                  <div className={styles.footer}>
                    <Button.Solid
                      onClick={() => {
                        router.push("/");
                      }}
                    >
                      Return to Homepage
                    </Button.Solid>
                  </div>
                </form>
              </>
            )}
          </Modal>
        </>
      ),
    };
  },
});

export default Page.defaultExport;
export const getServerSideProps = Page.getServerSideProps;

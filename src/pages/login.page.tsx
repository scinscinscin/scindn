import { PublicLayout } from "../layouts/public";
import { client } from "../utils/apiClient";
import { useForm } from "react-hook-form";
import { toast } from "react-toastify";
import { Button } from "./components/Button";
import { useRouter } from "next/router";

const Page = PublicLayout.createPage<{}>({
  page() {
    const LoginForm = useForm<{ username: string; password: string }>();
    const router = useRouter();

    return {
      seo: { title: "Login" },

      children: (
        <div>
          <form
            className="form"
            onSubmit={LoginForm.handleSubmit(async ({ username, password }) => {
              try {
                await client["/user"]["/login"].post({ body: { username, password } });
                toast.success("Successfully logged in", { autoClose: 3000 });
                setTimeout(() => router.push("/"), 3000);
              } catch {
                toast.error("Incorrect credentials");
              }
            })}
          >
            <div className="field">
              <label htmlFor="username">Username</label>
              <input {...LoginForm.register("username", { required: true })} />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input {...LoginForm.register("password", { required: true })} type="password" />
            </div>

            <Button.Solid onClick="submit">Login</Button.Solid>
          </form>
        </div>
      ),
    };
  },
});

export default Page.defaultExport;
export const getServerSideProps = Page.getServerSideProps;

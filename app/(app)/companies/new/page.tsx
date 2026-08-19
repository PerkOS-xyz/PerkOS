import { redirect } from "next/navigation";

/** Legacy alias. Project creation lives at /projects/new. */
export default function CompaniesNewRedirect() {
  redirect("/projects/new");
}

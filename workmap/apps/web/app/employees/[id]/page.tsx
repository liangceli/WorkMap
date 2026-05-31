import { notFound } from "next/navigation";
import { EmployeeProfile } from "../../../components/employees/EmployeeProfile";
import { AppShell } from "../../../components/layout/AppShell";
import { employeeDirectoryRows } from "../../../lib/mock/mockPeople";

type EmployeeDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export function generateStaticParams() {
  return employeeDirectoryRows.map((employee) => ({
    id: employee.id,
  }));
}

export async function generateMetadata({ params }: EmployeeDetailPageProps) {
  const { id } = await params;
  const employee = employeeDirectoryRows.find((candidate) => candidate.id === id);

  return {
    title: employee ? `${employee.name} | WorkMap` : "Employee | WorkMap",
  };
}

export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
  const { id } = await params;
  const employee = employeeDirectoryRows.find((candidate) => candidate.id === id);

  if (!employee) {
    notFound();
  }

  const teammates = employeeDirectoryRows.filter(
    (candidate) => candidate.department === employee.department && candidate.id !== employee.id,
  );

  return (
    <AppShell>
      <EmployeeProfile employee={employee} teammates={teammates} />
    </AppShell>
  );
}

import { Group, Pagination } from "@mantine/core";

export function Pager(props: {
  totalPages: number;
  page: number;
  onPage: (page: number) => void;
}) {
  if (props.totalPages <= 1) {
    return null;
  }
  return (
    <Pagination
      total={props.totalPages}
      value={props.page}
      onChange={props.onPage}
    />
  );
}

export function CenteredPager(props: {
  totalPages: number;
  page: number;
  onPage: (page: number) => void;
}) {
  if (props.totalPages <= 1) {
    return null;
  }
  return (
    <Group justify="center" mt="xl">
      <Pager {...props} />
    </Group>
  );
}

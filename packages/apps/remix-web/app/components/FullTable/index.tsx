import React, { FC } from 'react';
import { Table, Pagination } from 'flowbite-react';

export const FullTable: FC<Props> = ({ columns, data, totalPages = 0, currentPage, onPageChange }) => {
  const renderPagination = () => {
    if (!currentPage || !onPageChange) {
      return null;
    }

    return (
      <Pagination
        layout="navigation"
        totalPages={totalPages}
        currentPage={currentPage}
        onPageChange={onPageChange}
      />
    );
  };

  return (
    <div className="mx-auto">
      <div className="overflow-x-auto">
        <Table>
          {/* header */}
          <Table.Head>
            {columns.map((column) => {
              return <Table.HeadCell key={column.key}>{column.name}</Table.HeadCell>;
            })}
          </Table.Head>

          {/* body */}
          <Table.Body className="divide-y">
            {(data || []).map((row) => {
              const value = row.value;
              return (
                // table row
                <Table.Row className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  {Object.keys(value).map((field) => {
                    // table cell
                    return <Table.Cell>{value[field]}</Table.Cell>;
                  })}
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      </div>
      <div className="flex justify-end py-4">{renderPagination()}</div>
    </div>
  );
};

export interface Props {
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;

  columns: ColumnProp[];
  data: ColumnData[];
}

export interface ColumnProp {
  key: string;
  name: string;
}
export interface ColumnData {
  value: any;
  render?: (data: ColumnData) => React.ReactNode;
}

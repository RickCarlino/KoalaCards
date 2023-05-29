import React, { useState } from "react";
import { Table, Checkbox, Button, Col, Grid } from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/router";
import { Phrase } from "@prisma/client";
import { IconPencil } from "@tabler/icons-react";

interface PhraseTableProps {
  phrases: Phrase[];
}

export const PhraseTable: React.FC<PhraseTableProps> = ({ phrases }) => {
  const [selectedPhrases, setSelectedPhrases] = useState<number[]>([]);
  const router = useRouter();

  const handleSelect = (id: number) => {
    if (selectedPhrases.includes(id)) {
      setSelectedPhrases(selectedPhrases.filter((phraseId) => phraseId !== id));
    } else {
      setSelectedPhrases([...selectedPhrases, id]);
    }
  };

  const handleFlagAll = () => {
    alert("TODO");
  };

  const handleUnflagAll = () => {
    alert("TODO");
  };

  const handleDeleteAll = () => {
    alert("TODO");
  };

  return (
    <Grid>
      <Col style={{ marginBottom: "10px" }}>
        <Button onClick={handleFlagAll}>Flag All</Button>
        <Button onClick={handleUnflagAll}>Unflag All</Button>
        <Button color="red" onClick={handleDeleteAll}>
          Delete All
        </Button>
      </Col>
      <Table>
        <thead>
          <tr>
            <th></th>
            <th>ID</th>
            <th>Flagged</th>
            <th>English</th>
            <th>Korean</th>
            <th>Total Attempts</th>
            <th>Win Percentage</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {phrases.map((phrase) => (
            <tr key={phrase.id}>
              <td>
                <Checkbox
                  checked={selectedPhrases.includes(phrase.id)}
                  onChange={() => handleSelect(phrase.id)}
                />
              </td>
              <td>{phrase.id}</td>
              <td>{phrase.flagged.toString()}</td>
              <td>{phrase.en}</td>
              <td>{phrase.ko}</td>
              <td>{phrase.total_attempts}</td>
              <td>{phrase.win_percentage}</td>
              <td>
                <Button onClick={() => router.push(`/cards/${phrase.id}`)}>
                  <IconPencil stroke={1.5}/>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Grid>
  );
};

import React, { useState } from 'react';
import { BASE_URL } from './settings';
import {
  Box,
  Button,
  expandRecord,
  FieldPickerSynced,
  FormField,
  Heading,
  Icon,
  initializeBlock,
  Input,
  Select,
  Text,
  Dialog,
  useBase,
  useGlobalConfig,
  useRecords,
  useRecordById,
  colors
} from '@airtable/blocks/ui';
import { FieldType } from '@airtable/blocks/models';
import { globalConfig } from "@airtable/blocks";


function MTurkBlock() {
  const base = useBase();

  // Read the user's choice for which table and view to use from globalConfig.
  const globalConfig = useGlobalConfig();
  const tableId = globalConfig.get('selectedTableId');
  const fromFieldId = globalConfig.get('selectedFromFieldId');
  const toFieldId = globalConfig.get('selectedToFieldId');

  const table = base.getTableByIdIfExists(tableId);
  const fromField = table ? table.getFieldByIdIfExists(fromFieldId) : null;
  const toField = table ? table.getFieldByIdIfExists(toFieldId) : null;


  function setGlobalValue(key, value) {
    const setCheckResult = globalConfig.setAsync(key, value);
  }

  function getGlobalValue(key) {
    return globalConfig.get(key);
  }

  function replaceText(template, cellId) {
    return template.replace("{text}", cellId);
  }

  function setTemplateOrDialog(newValue) {
    if (newValue === 'custom') {
      setAddingCustomTemplate(true)
    } else {
      setTemplate(newValue)
    }
  }

  function onAddCustomTemplate(event) {
    event.preventDefault();
    const arr = getGlobalValue('customTemplateTexts')
    arr.push(customTemplateText)
    setGlobalValue('customTemplateTexts', arr);
    setAddingCustomTemplate(false)
    setCustomTemplateText('');
  }

  function populateTemplates() {
    getGlobalValue('customTemplateTexts').map(customText => {
      options.push({
        value: customText,
        label: customText
      })
    })
    options.push(
        {
          value: "custom",
          label: "Custom"
        });

    return options;
  }

  async function getStatus(baseId) {
    const requestUrl = `${BASE_URL}.json/?base_id=${baseId}`;
    const completedTasks = await (await fetch(requestUrl, {
      cors: true, headers: {
        "Content-Type": "application/json",
        "AWS_KEY": globalConfig.get('aws_key'),
        "AWS_SECRET": globalConfig.get('aws_secret')
      }
    })).json();
    setCompletedTasksFromServer(completedTasks);
  }

  async function completeTask(cellId) {
    const opts = {
      base_id: base.id,
      cell_id: cellId,
    }
    const result = await (await fetch(`${BASE_URL}/complete.json`, {
      method: 'post', body: JSON.stringify(opts), cors: true, headers: {
        "Content-Type": "application/json",
        "AWS_KEY": globalConfig.get('aws_key'),
        "AWS_SECRET": globalConfig.get('aws_secret')
      },
    })).json();
  }

  async function uploadTask() {
    let questionRaw = cellRecordIdAndLabel.split('|||')[1];
    const question = replaceText(template, questionRaw)
    const opts = {
      base_id: base.id,
      cell_id: cellRecordIdAndLabel.split('|||')[0],
      question_raw: questionRaw,
      question: question,
      cost: costPerTask
    }
    const result = await (await fetch(`${BASE_URL}.json`, {
      method: 'post', body: JSON.stringify(opts), cors: true, headers: {
        "Content-Type": "application/json",
        "AWS_KEY": globalConfig.get('aws_key'),
        "AWS_SECRET": globalConfig.get('aws_secret')
      },
    })).json();

    debugger
    if (result) {
      setIsDialogOpen(true);
    }
  }

  // Don't need to fetch records if doneField doesn't exist (the field or it's parent table may
  // have been deleted, or may not have been selected yet.)
  const records = useRecords(table, { fields: [fromField] });
  const options = [
    {
      value: "Please translate this text into French - '{text}'",
      label: "Manual Translation To French"
    },
    {
      value: "Please help me find a recent 1-2 lines newsworthy summary for the company {text}.",
      label: "Sales"
    },
  ];

  const [template, setTemplate] = useState(options[0].value);
  const [cellRecordIdAndLabel, setCellRecordIdAndLabel] = useState('');
  const [addingCustomTemplate, setAddingCustomTemplate] = useState(false);
  const [customTemplateText, setCustomTemplateText] = useState('');
  const [costPerTask, setCostPerTask] = useState(0.20);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [completedTasksFromServer, setCompletedTasksFromServer] = useState([]);

  function settingsBox() {
    return <Box padding={3} margin={3} border="default" borderRadius={8}>
      <Heading paddingTop={1} size="medium">Welcome to Mechanical Turk</Heading>
      <Heading size="xsmall" textColor="light">Get manual tasks done for you, easily! Please
        follow the these instructions to get started.</Heading>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        fontSize: 18,
        padding: 0
      }}>
        <Icon name="ul" size={23}/>
        <Text paddingLeft={2} size="xsmall">Configuration</Text>
      </div>
      <FormField label="AWS Key">
        <Input value={getGlobalValue("aws_key")}
               onChange={e => setGlobalValue("aws_key", e.target.value)}/>
      </FormField>
      <FormField label="AWS Secret">
        <Input value={getGlobalValue("aws_secret")}
               onChange={e => setGlobalValue("aws_secret", e.target.value)}/>
      </FormField>
      <FormField label="Field to use data from" marginBottom={3}>
        <FieldPickerSynced
            table={table}
            globalConfigKey="selectedFromFieldId"
            placeholder="Field to use data from"
            allowedTypes={[FieldType.MULTILINE_TEXT, FieldType.SINGLE_LINE_TEXT, FieldType.RICH_TEXT]}
        />
      </FormField>
      <FormField label="Field to write data to" marginBottom={3}>
        <FieldPickerSynced
            table={table}
            globalConfigKey="selectedToFieldId"
            placeholder="Field to write data to"
            allowedTypes={[FieldType.MULTILINE_TEXT, FieldType.SINGLE_LINE_TEXT, FieldType.RICH_TEXT]}
        />
      </FormField>
    </Box>;
  }

  function reviewOutputText() {
    return <Text
        display={cellRecordIdAndLabel ? 'block' : 'none'}
        disabled={!cellRecordIdAndLabel}
        style={{
          fontStyle: 'italic',
          fontWeight: 'bold'
        }}>{replaceText(template, cellRecordIdAndLabel.split('|||')[1])}</Text>;
  }

  function createTaskBox() {

    return <Box padding={3} margin={3} border="default" borderRadius={8}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        fontSize: 18,
        padding: 0
      }}>
        <Icon name="bolt" size={23}/>
        <Text paddingLeft={2} size="xsmall">Send a Task to Mechanical Turk</Text>
      </div>

      <FormField label="Enter how much you would like to pay for each task (in USD)">
        <Input
            type="textarea"
            flex="auto"
            value={costPerTask}
            onChange={e => setCostPerTask(e.target.value)}
            placeholder="ie. 0.20"
        />
      </FormField>

      <FormField label="Pick a template to use">
        <Select
            options={populateTemplates()}
            value={template}
            onChange={newValue => setTemplateOrDialog(newValue)}
        />
      </FormField>

      <form onSubmit={onAddCustomTemplate}>
        <Box display="flex" padding={0} borderRadius={8}>
          <FormField
              style={{
                display: addingCustomTemplate ? 'block' : 'none'
              }}
              label="Add your own template">
            <Input
                type="textarea"
                flex="auto"
                onChange={e => setCustomTemplateText(e.target.value)}
                placeholder="Custom instruction for task. Use the placeholder {text} to substitute the value to send."
            />
            <Button variant="primary" marginLeft={0} marginTop={1} type="submit">
              Add
            </Button>
          </FormField>
        </Box>
      </form>

      <FormField label="Select the value to use for the task">
        <Select
            options={records.map(record => {
              return {
                value: `${record.id}|||${record.getCellValueAsString(fromField)}`,
                label: record.getCellValueAsString(fromField)
              }
            })}
            value={cellRecordIdAndLabel}
            onChange={newValue => setCellRecordIdAndLabel(newValue)}
        />
      </FormField>
      <FormField label="Review Output" marginBottom={3}>
        {reviewOutputText()}
      </FormField>
      <Button
          onClick={() => uploadTask(base.id, cellRecordIdAndLabel)}
          variant="primary"
          size="large"
          icon="premium"
          type="submit"
          disabled={!cellRecordIdAndLabel}
      >
        Upload Task To Mechanical Turk
      </Button>
    </Box>;
  }

  function maybeDisplayCompletedTasks() {
    return completedTasksFromServer
        ? completedTasksFromServer.map(task => {
          return <div>
            <div style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              fontSize: 18,
              padding: 0
            }}>
              <Icon name="checklist" size={23}/>
              <Text paddingLeft={2} size="xsmall">{task.question_raw}</Text>
            </div>
            <CompletedTask key={task.cell_id} task={task} table={table} doneField={toField}/>
          </div>;
        })
        : null;
  }

  function syncBox() {
    return <Box padding={3} paddingBottom={4} marginLeft={3} marginBottom={3} border="default"
                borderRadius={8}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        fontSize: 18,
        padding: 0
      }}>
        <Icon name="bolt" size={23}/>
        <Text paddingLeft={2} size="xsmall">Sync Completed Tasks</Text>
      </div>
      <Button
          marginBottom={3}
          onClick={() => getStatus(base.id)}
          variant="primary"
          size="large"
          icon="premium"
          type="submit"
      >
        Retrieve Completed Tasks
      </Button>
      {maybeDisplayCompletedTasks()}
    </Box>;
  }

  function uploadSuccessDialog() {
    return (
        <React.Fragment>
          {isDialogOpen && (
              <Dialog onClose={() => setIsDialogOpen(false)} width="320px">
                <Dialog.CloseButton/>
                <Heading>Task Uploaded!</Heading>
                <Text variant="paragraph">
                  Hooray! We have created the manual Mechanical Turk task for you. Check back later
                  to see the submissions!
                </Text>
                <Button onClick={() => setIsDialogOpen(false)}>Close</Button>
              </Dialog>)}
        </React.Fragment>
    )
  }

  function TaskSelectButton({ table, recordId, doneField, response }) {
    function onclick() {
      completeTask(recordId).then((value) => {
        table.updateRecordAsync(recordId, {
          [doneField.id]: response,
        });

        setCompletedTasksFromServer(completedTasksFromServer.filter((item) => {
          return item.cell_id !== recordId
        }));
      })
    }

    const permissionCheck = table.checkPermissionsForUpdateRecord(recordId, {
      [doneField.id]: undefined,
    });

    return (
        <Button
            marginLeft={2}
            onClick={onclick}
            size="small"
            disabled={!permissionCheck.hasPermission}
        >
          select
        </Button>
    );
  }

  function CompletedTask({ task, table, doneField }) {
    return (
        <div>
          {responses(task, table, doneField)}
        </div>
    );
  }

  function responses(task, table, doneField) {
    return task.responses.map(response => {
      return <Box overflowX="auto" padding={2} marginTop={2} backgroundColor={colors.GREEN}
                  border="thick"
                  borderRadius={8}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          padding: 0
        }}>
          <Text paddingLeft={2} size="large" textColor={"white"}>{response}</Text>
          <TaskSelectButton table={table} recordId={task.cell_id} doneField={doneField}
                            response={response}/>
        </div>
      </Box>
    })
  }

  return (
      <div>
        {settingsBox()}
        {createTaskBox()}
        {syncBox()}
        {uploadSuccessDialog()}
      </div>
  );
}


initializeBlock(() => <MTurkBlock/>);

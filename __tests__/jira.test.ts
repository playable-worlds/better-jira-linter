/* eslint-disable i18n-text/no-en */
/* eslint-disable filenames/match-regex */

import { Jira } from '../src/jira';
import { GitHub } from '../src/github';
import { JIRADetails } from '../src/types';

jest.spyOn(console, 'log').mockImplementation(); // avoid actual console.log in test output

describe('getJIRAIssueKeys()', () => {
  it('extracts a jira key from the beginning of the branch name', () => {
    // key right at the start
    expect(Jira.getJIRAIssueKeys('MOJO-6789')).toEqual(['MOJO-6789']);
    expect(Jira.getJIRAIssueKeys('MOJO-6789/task_with_underscores')).toEqual(['MOJO-6789']);
    expect(Jira.getJIRAIssueKeys('MOJO-6789-task_with_underscores')).toEqual(['MOJO-6789']);

    // key after a prefix (feature/, fix/, chore/, etc.)
    expect(Jira.getJIRAIssueKeys('feature/MOJO-6789-some-description')).toEqual(['MOJO-6789']);
    expect(Jira.getJIRAIssueKeys('fix/ES-43-login-protocol')).toEqual(['ES-43']);
    expect(Jira.getJIRAIssueKeys('chore/MOJO-6789-task_with_underscores')).toEqual(['MOJO-6789']);

    // case insensitive project key (normalized to uppercase)
    expect(Jira.getJIRAIssueKeys('feature/mojo-123-description')).toEqual(['MOJO-123']);
    expect(Jira.getJIRAIssueKeys('feature/esch-100-new-feature')).toEqual(['ESCH-100']);
    expect(Jira.getJIRAIssueKeys('fix/es-43-login-fix')).toEqual(['ES-43']);

    // project key with digits (e.g. PB2, P2P)
    expect(Jira.getJIRAIssueKeys('feature/PB2-1-some-task')).toEqual(['PB2-1']);
    expect(Jira.getJIRAIssueKeys('feature/P2P-99-peer-update')).toEqual(['P2P-99']);
  });

  it('ignores numbers elsewhere in the branch name', () => {
    // numbers in description should NOT produce false matches
    expect(Jira.getJIRAIssueKeys('feature/MOJO-123-add-step-2')).toEqual(['MOJO-123']);
    expect(Jira.getJIRAIssueKeys('feature/MOJO-123-es-43-thing')).toEqual(['MOJO-123']);
    expect(Jira.getJIRAIssueKeys('fix/ES-43-update-v2-config')).toEqual(['ES-43']);

    // version-like numbers in the description (e.g. node-24-0-3)
    expect(Jira.getJIRAIssueKeys('MOJO-123-update-node-24-0-3')).toEqual(['MOJO-123']);
    expect(Jira.getJIRAIssueKeys('feature/MOJO-123-update-node-24-0-3')).toEqual(['MOJO-123']);
    expect(Jira.getJIRAIssueKeys('chore/GAL-99-migrate-react-18-to-19')).toEqual(['GAL-99']);
  });

  it('returns only one key (the one at the beginning)', () => {
    // even if branch name contains something that looks like a second key later, only the first is returned
    expect(Jira.getJIRAIssueKeys('MOJO-6789/task_with_underscores-ES-43')).toEqual(['MOJO-6789']);
  });

  it('returns empty when no key is at the beginning', () => {
    // key not at the start (after prefix) - these should NOT match
    expect(Jira.getJIRAIssueKeys('feature/newFeature--MOJO-6789')).toEqual([]);
    expect(Jira.getJIRAIssueKeys('fix/login-protocol-ES-43')).toEqual([]);
    expect(Jira.getJIRAIssueKeys('nudge-live-chat-users-Es-172')).toEqual([]);

    // no key at all
    expect(Jira.getJIRAIssueKeys('feature/missingKey')).toEqual([]);
    expect(Jira.getJIRAIssueKeys('')).toEqual([]);
  });
});

describe('getPRDescription()', () => {
  const issue: JIRADetails = {
    key: 'ABC-123',
    url: 'url',
    type: { name: 'feature', icon: 'feature-icon-url' },
    estimate: 1,
    labels: [{ name: 'frontend', url: 'frontend-url' }],
    summary: 'Story title or summary',
    project: { name: 'project', url: 'project-url', key: 'abc' },
    status: 'In Progress',
  };

  it('should include the hidden marker when getting PR description', () => {
    const description = Jira.getPRDescription('some_body', issue);

    expect(GitHub.shouldUpdatePRDescription(description)).toBeFalsy();
    expect(description).toContain(issue.key);
    expect(description).toContain(issue.estimate.toString());
    expect(description).toContain(issue.status);
    expect(description).toContain(issue.labels[0].name);
  });

  it('should work with null description', () => {
    const description = Jira.getPRDescription(null, issue);

    expect(description).toContain(issue.key);
    expect(description).toContain(issue.estimate.toString());
    expect(description).toContain(issue.status);
    expect(description).toContain(issue.labels[0].name);
  });
});

describe('getNoIdComment()', () => {
  it('should return the comment content with the branch name', () => {
    expect(Jira.getNoIdComment('test_new_feature')).toContain('test_new_feature');
  });
});

describe('getLabelsForDisplay()', () => {
  it('generates label markup without spaces', () => {
    expect(
      Jira.getLabelsForDisplay([
        { name: 'one', url: 'url-one' },
        { name: 'two', url: 'url-two' },
      ])
    ).toBe(`<a href="url-one" title="one">one</a>, <a href="url-two" title="two">two</a>`);
  });
});

describe('JIRA Client', () => {
  // use this to test if the token is correct
  it.skip('should be able to access the issue', async () => {
    const jira = new Jira('https://cleartaxtech.atlassian.net/', '<username>', '<token_here>');
    const details = await jira.getTicketDetails('ES-10');
    console.log({ details });
    expect(details).not.toBeNull();
  });
});

describe('isIssueStatusValid()', () => {
  const issue: JIRADetails = {
    key: 'ABC-123',
    url: 'url',
    type: { name: 'feature', icon: 'feature-icon-url' },
    estimate: 1,
    labels: [{ name: 'frontend', url: 'frontend-url' }],
    summary: 'Story title or summary',
    project: { name: 'project', url: 'project-url', key: 'abc' },
    status: 'Assessment',
  };

  it('should return false if issue validation was enabled but invalid issue status', () => {
    const expectedStatuses = ['In Test', 'In Progress'];
    expect(Jira.isIssueStatusValid(true, expectedStatuses, issue)).toBeFalsy();
  });

  it('should return true if issue validation was enabled but issue has a valid status', () => {
    const expectedStatuses = ['In Test', 'In Progress'];
    issue.status = 'In Progress';
    expect(Jira.isIssueStatusValid(true, expectedStatuses, issue)).toBeTruthy();
  });

  it('should return true if issue status validation is not enabled', () => {
    const expectedStatuses = ['In Test', 'In Progress'];
    expect(Jira.isIssueStatusValid(false, expectedStatuses, issue)).toBeTruthy();
  });
});

describe('getInvalidIssueStatusComment()', () => {
  it('should return content with the passed in issue status and allowed statses', () => {
    expect(Jira.getInvalidIssueStatusComment('Assessment', ['In Progress'])).toContain('Assessment');
    expect(Jira.getInvalidIssueStatusComment('Assessment', ['In Progress'])).toContain('In Progress');
  });
});

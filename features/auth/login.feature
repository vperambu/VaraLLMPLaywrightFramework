# ═══════════════════════════════════════════════════════════════════
# Feature: User Authentication – Login Flow
#
# Generated via: SmartGen Pipeline (RAG)
# Jira Story: AUTH-101 — User Login
# Tags: @smoke @regression @ui @auth
# ═══════════════════════════════════════════════════════════════════

@auth @ui
Feature: User Authentication – Login

  As a registered user
  I want to log into the application securely
  So that I can access my personalized dashboard

  Background:
    Given the application is available at the base URL
    And I am on the login page

  # ──────────────────────────────────────────────────────────────
  # Happy Path
  # ──────────────────────────────────────────────────────────────

  @smoke @positive
  Scenario: Successful login with valid credentials
    When I enter username "standard_user" and password "secret_sauce"
    And I click the sign in button
    Then I should be redirected to the dashboard
    And I should see a personalized welcome message

  # ──────────────────────────────────────────────────────────────
  # Negative Scenarios
  # ──────────────────────────────────────────────────────────────

  @negative
  Scenario Outline: Login fails with invalid credentials
    When I enter username "<username>" and password "<password>"
    And I click the sign in button
    Then I should see an error message containing "<errorText>"
    And I should remain on the login page

    Examples:
      | username        | password        | errorText                          |
      | wrong_user      | secret_sauce    | Username and password do not match |
      | standard_user   | wrong_pass      | Username and password do not match |
      |                 | secret_sauce    | Username is required               |
      | standard_user   |                 | Password is required               |

  @negative
  Scenario: Login fails with locked-out account
    When I enter username "locked_out_user" and password "secret_sauce"
    And I click the sign in button
    Then I should see an error message containing "locked out"
    And I should remain on the login page

  # ──────────────────────────────────────────────────────────────
  # MFA Flow (stub)
  # ──────────────────────────────────────────────────────────────

  @mfa @stub
  Scenario: MFA prompt appears for MFA-enabled accounts
    Given I have an account with MFA enabled
    When I enter username "mfa_user" and password "secret_sauce"
    And I click the sign in button
    Then I should see the MFA verification prompt
    When I enter the MFA code "123456"
    And I submit the MFA code
    Then I should be redirected to the dashboard

  # ──────────────────────────────────────────────────────────────
  # Session
  # ──────────────────────────────────────────────────────────────

  @regression
  Scenario: User can log out successfully
    Given I am logged in as "standard_user" with password "secret_sauce"
    When I click the user menu
    And I click the logout button
    Then I should be redirected to the login page
    And I should not be able to access the dashboard directly
